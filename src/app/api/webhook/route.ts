import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhook-secret";
import { extractMessageText, extractButtonText, extractListText, extractRawButtonId } from "@/lib/webhook/extract";
import { hasPlan, type WebhookContext } from "@/lib/webhook/context";
import { handleWelcome } from "@/lib/webhook/welcome";
import { handleOutsideHours } from "@/lib/webhook/outside-hours";
import { handleBookingIntent, handleDateSelect, handleSlotSelect, handleAppointmentConfirm, handleAgendaMenu, handleNumericSlotSelect, isAgendaActive } from "@/lib/webhook/booking";
import { handleMenuTap, handleMenuTextReply } from "@/lib/webhook/menus";
import { handleAutoReply } from "@/lib/webhook/auto-reply";
import { handleCatalogIntent } from "@/lib/webhook/catalog";
import type { PlanType } from "@/lib/db/types";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  event: string;
  instance: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string };
    message?: Record<string, unknown>;
    pushName?: string;
    messageTimestamp?: number;
    id?: string;
    participant?: string;
    action?: "add" | "remove";
  };
}

// query() ya devuelve el array de filas directamente (mysql2). Antes se hacía
// `const [{ rows }]` que devolvía undefined.rows y crasheaba cada webhook.
async function select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const rows = await query<T>(sql, params);
  return Array.isArray(rows) ? rows : [];
}

async function update(sql: string, params: any[] = []): Promise<{ affectedRows: number }> {
  const res = await query<{ affectedRows: number }>(sql, params);
  return { affectedRows: res?.affectedRows ?? 0 };
}

export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "webhook", { maxRequests: 100, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  let rawBody: string;
  try { rawBody = await request.text(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 });
  }

  if (!(await verifyWebhookSignature(request, rawBody))) {
    console.warn("[webhook] firma invalida", { ip: getClientIp(request) });
    return NextResponse.json({ status: "error", error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try { body = JSON.parse(rawBody) as WebhookPayload; } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  // Community features removed — ignore group events and group messages
  if (body.event === "group-participants.update") {
    return NextResponse.json({ status: "ignored" });
  }

  // Only process incoming messages from here
  if (body.event !== "messages.upsert") return NextResponse.json({ status: "ignored" });
  if (body.data?.key?.fromMe) return NextResponse.json({ status: "ignored" });

  const instanceName = body.instance;
  const remoteJid = body.data?.key?.remoteJid || "";
  if (remoteJid.includes("@g.us")) {
    return NextResponse.json({ status: "ignored" });
  }
  const plainText = extractMessageText(body.data?.message);
  const buttonText = extractButtonText(body.data?.message);
  const listText = extractListText(body.data?.message);
  const effectiveText = plainText || buttonText || listText;

  if (!instanceName || !remoteJid || !effectiveText) {
    return NextResponse.json({ status: "ignored" });
  }

  // ============================================================
  // DM MESSAGES → load instance + plan + shared context
  // ============================================================
  const instances = await select<{ id: string; instance_name: string; evolution_api_url: string; evolution_api_key: string; welcome_message: string | null; outside_hours_message: string | null }>(
    "SELECT id, instance_name, evolution_api_url, evolution_api_key, welcome_message, outside_hours_message FROM instances WHERE instance_name = ? LIMIT 1",
    [instanceName]
  );

  if (instances.length === 0) {
    console.error("[webhook] instancia no encontrada", { instance: instanceName, from: remoteJid });
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const instance = instances[0];

  // Fetch plan: look at subscriptions of assigned users + instance admin
  const assignments = await select<{ user_id: string }>(
    "SELECT user_id FROM user_instances WHERE instance_id = ?",
    [instance.id]
  );

  const adminRows = await select<{ admin_id: string }>(
    "SELECT admin_id FROM instances WHERE id = ? LIMIT 1",
    [instance.id]
  );

  // Plan resolution: admin = pro; otherwise from active subscriptions
  const adminUserId = adminRows?.[0]?.admin_id;
  const proUserIds = new Set<string>();
  if (assignments.length > 0) {
    const userIds = assignments.map((a) => a.user_id);
    const subs = await select<{ user_id: string; plan_type: string }>(
      "SELECT user_id, plan_type FROM subscriptions WHERE user_id IN (?) AND status = 'active'",
      [userIds]
    );
    for (const s of subs) {
      if (s.plan_type === "pro") proUserIds.add(s.user_id);
    }
  }
  // Instance admin always counts as pro
  if (adminUserId && !proUserIds.has(adminUserId)) {
    proUserIds.add(adminUserId);
  }

  const userIsPro = proUserIds.has(adminUserId) || proUserIds.size > 0;
  const userPlan: PlanType = userIsPro ? "pro" : "starter";

  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");

  // Log DM messages that look like booking intents to diagnose plan resolution
  if (effectiveText && /(turno|agenda|agendar|reservar|cita)/i.test(effectiveText)) {
    console.log("[webhook] booking intent dm", { instance: instanceName, plan: userPlan, from: remoteJid, text: effectiveText.slice(0, 40) });
  }

  // Pre-fetch auto-responses (shared across handlers)
  const autoResponses = await select<{
    id: string; keyword: string | null; regex_pattern: string | null;
    response_text: string; response_type: string; menu_config: any | null;
    response_media_url: string | null; priority: number; schedule: any | null; user_id: string;
  }>(
    "SELECT id, keyword, regex_pattern, response_text, response_type, menu_config, response_media_url, priority, schedule, user_id FROM auto_responses WHERE instance_id = ? AND is_active = true ORDER BY priority DESC",
    [instance.id]
  );

  // Build shared context
  const ctx: WebhookContext = {
    supabase: { query, pool: { execute: query } as any },
    instance, plan: userPlan, instanceName, remoteJid, phoneNumber,
    effectiveText, buttonText, listText,
    pushName: body.data?.pushName,
    messageId: body.data?.key?.id,
    senderJid: body.data?.key?.participant,
    rawButtonId: extractRawButtonId(body.data?.message) || undefined,
    autoResponses: autoResponses || [],
  };

  // Plain-text menu navigation (Evolution 2.3.7 button fallback):
  // if a menu is active, "1"/"2"/"3" picks an option and "0"/"volver" goes back.
  // Runs before booking so numeric replies don't clash with the agenda.
  if (!buttonText && !listText) {
    const menuTextResult = await handleMenuTextReply(ctx);
    if (menuTextResult) return NextResponse.json(menuTextResult);
  }

  // ============================================================
  // PRO features: appointment booking flow
  // ============================================================
  if (hasPlan(userPlan, "pro")) {
    // Reminder confirm/cancel: confirm_<id> or cancel_<id>
    const rawBtnId = extractRawButtonId(body.data?.message);
    const checkId = rawBtnId || effectiveText;

    if (checkId.startsWith("confirm_") || checkId.startsWith("cancel_")) {
      ctx.effectiveText = checkId;
      const result = await handleAppointmentConfirm(ctx);
      if (result) return NextResponse.json(result);
    }

    // Slot selection: slot_<date>_<time>
    if (checkId.startsWith("slot_")) {
      ctx.effectiveText = checkId;
      const result = await handleSlotSelect(ctx);
      if (result) return NextResponse.json(result);
    }

    // Numeric reply to a text menu (e.g. "2" for a slot previously shown)
    const numericResult = await handleNumericSlotSelect(ctx);
    if (numericResult) return NextResponse.json(numericResult);

    // Date selection: date_<YYYY-MM-DD>
    if (checkId.startsWith("date_")) {
      ctx.effectiveText = checkId;
      const result = await handleDateSelect(ctx);
      if (result) return NextResponse.json(result);
    }

    // Agenda menu: agenda_hoy / agenda_proximo / agenda_completa
    // (also matches plain-text replies: "1", "hoy", "próximo", "completa", etc.)
    const menuTextMatch = checkId.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
    if (
      await isAgendaActive(ctx) &&
      (checkId === "agenda_hoy" || checkId === "agenda_proximo" || checkId === "agenda_completa" ||
      ["1", "hoy", "librehoy", "2", "proximo", "masproximo", "3", "completa", "agendacompleta"].includes(menuTextMatch))
    ) {
      ctx.effectiveText =
        checkId === "1" || menuTextMatch === "hoy" || menuTextMatch === "librehoy" ? "agenda_hoy"
        : checkId === "2" || menuTextMatch === "proximo" || menuTextMatch === "masproximo" ? "agenda_proximo"
        : checkId === "3" || menuTextMatch === "completa" || menuTextMatch === "agendacompleta" ? "agenda_completa"
        : checkId;
      const result = await handleAgendaMenu(ctx);
      if (result) return NextResponse.json(result);
    }

    // Booking intent: "turno", "agendar", etc.
    const result = await handleBookingIntent(ctx);
    if (result) return NextResponse.json(result);
  }

  // ============================================================
  // STARTER features: welcome, outside hours, menus, auto-reply
  // ============================================================

  // Welcome message (first-time writer)
  await handleWelcome(ctx);

  // Outside hours auto-reply (stops processing if triggered)
  const outsideResult = await handleOutsideHours(ctx);
  if (outsideResult) return NextResponse.json(outsideResult);

  // Menu button/list tap
  if (buttonText || listText) {
    const menuResult = await handleMenuTap(ctx);
    if (menuResult) return NextResponse.json(menuResult);
  }

  // ============================================================
  // CATALOG / Pedidos genéricos ( Starter + Pro )
  // ============================================================
  const catalogResult = await handleCatalogIntent(ctx);
  if (catalogResult) return NextResponse.json(catalogResult);

  // Regular keyword/regex matching
  const replyResult = await handleAutoReply(ctx);
  return NextResponse.json(replyResult);
}

/** Look up the subscription plan for an instance (admin=pro, assigned users from subscriptions) */
async function resolvePlanForInstance(instanceId: string): Promise<PlanType> {
  const hierarchy: PlanType[] = ["starter", "pro"];
  let best: PlanType = "starter";

  const resolveUserPlan = async (userId: string) => {
    if (!userId) return;
    const rows = await select<{ plan_type: string }>(
      "SELECT plan_type FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1",
      [userId]
    );
    const plan = rows[0]?.plan_type as PlanType | undefined;
    if (plan && hierarchy.indexOf(plan) > hierarchy.indexOf(best)) {
      best = plan;
    }
  };

  // Assigned users
  const assignments = await select<{ user_id: string }>(
    "SELECT user_id FROM user_instances WHERE instance_id = ?",
    [instanceId]
  );
  for (const a of assignments) {
    await resolveUserPlan(a.user_id);
  }

  // Instance admin (owner) always counts
  const adminRows = await select<{ admin_id: string }>(
    "SELECT admin_id FROM instances WHERE id = ? LIMIT 1",
    [instanceId]
  );
  await resolveUserPlan(adminRows?.[0]?.admin_id);

  return best;
}
