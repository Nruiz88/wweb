import { NextResponse } from "next/server";
import { query, generateId } from "@/lib/db";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhook-secret";
import { extractMessageText, extractButtonText, extractListText, extractRawButtonId } from "@/lib/webhook/extract";
import { hasPlan, createSupabaseMariaDB, type WebhookContext } from "@/lib/webhook/context";
import { handleWelcome } from "@/lib/webhook/welcome";
import { handleOutsideHours } from "@/lib/webhook/outside-hours";
import { handleBookingIntent, handleDateSelect, handleSlotSelect, handleAppointmentConfirm, handleAgendaMenu, handleNumericSlotSelect, handleSlotsMore, isAgendaActive } from "@/lib/webhook/booking";
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

// Nota: `update()` se eliminó. Era código muerto (nadie lo llamaba) y con la
// nueva firma de `query` pedía tipos que no existen. Para UPDATE/DELETE usar
// `exec()` de "@/lib/db".

/**
 * Auditoría durable del webhook.
 *
 * Los `console.log` solo viven en el stdout del contenedor (panel de Coolify),
 * que rota y no se puede consultar después. `webhook_logs` existe en el schema
 * desde siempre pero NUNCA se escribía: es el único lugar donde queda registro
 * de qué pasó con cada mensaje. Se lee en /admin (pestaña Webhook).
 *
 * Nunca debe romper el flujo: cualquier error acá se traga.
 */
async function logWebhook(
  eventType: string,
  status: "processed" | "failed" | "skipped",
  opts: { instanceId?: string | null; payload?: unknown; error?: string | null; userId?: string | null } = {},
) {
  try {
    await query(
      `INSERT INTO webhook_logs (id, event_type, instance_id, user_id, payload, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        String(eventType).slice(0, 255),
        opts.instanceId ?? null,
        opts.userId ?? null,
        opts.payload ? JSON.stringify(opts.payload).slice(0, 60000) : null,
        status,
        opts.error ? String(opts.error).slice(0, 2000) : null,
      ]
    );
  } catch (e) {
    console.error("[webhook] no se pudo auditar", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Snapshot acotado del payload para no guardar megabytes ni PII sensible. */
function auditPayload(body: WebhookPayload) {
  return {
    instance: body?.instance,
    remoteJid: body?.data?.key?.remoteJid,
    fromMe: body?.data?.key?.fromMe,
    text: String(
      (body?.data?.message as Record<string, unknown> | undefined)?.conversation ??
        (body?.data?.message as Record<string, unknown> | undefined)?.extendedTextMessage ?? ""
    ).slice(0, 300),
  };
}

/**
 * Responde Y audita. Todos los retornos de handler pasan por acá, así
 * `webhook_logs.status` + `payload.matched` muestran qué handler matcheó y con
 * qué texto — la forma de saber si el bot respondió "turno" sin tener logs
 * de runtime.
 */
async function reply(
  result: { status: string; matched?: string } | null,
  ctx: { instance: { id: string }; plan: string; effectiveText: string; remoteJid: string; isLid: boolean },
) {
  await logWebhook(result ? "handler_matched" : "no_handler_matched", "processed", {
    instanceId: ctx.instance.id,
    payload: {
      text: ctx.effectiveText.slice(0, 300),
      matched: result?.matched ?? null,
      status: result?.status ?? null,
      plan: ctx.plan,
      from: ctx.remoteJid,
      isLid: ctx.isLid,
    },
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  // Sin esto, cualquier excepción en un handler (columna inexistente, BD caída,
  // Evolution en timeout) devolvía un 500 sin log y el usuario veía silencio total.
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("[webhook] error no manejado", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ status: "error", error: "Internal error" }, { status: 500 });
  }
}

async function handleWebhook(request: Request) {
  // OJO: la clave por defecto es la IP, y todas las instancias de Evolution
  // salen desde el mismo servidor → el límite era compartido. Con 100/min un
  // pico de varios números a la vez saturaba y el bot devolvía 429 (silencio).
  const rateLimitErr = await rateLimitResponse(request, "webhook", { maxRequests: 600, windowMs: 60_000 });
  if (rateLimitErr) {
    await logWebhook("rate_limited", "skipped", { payload: { ip: getClientIp(request) } });
    return rateLimitErr;
  }

  let rawBody: string;
  try { rawBody = await request.text(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 });
  }

  if (!(await verifyWebhookSignature(request, rawBody))) {
    console.warn("[webhook] firma invalida", { ip: getClientIp(request) });
    await logWebhook("invalid_signature", "skipped", { payload: { ip: getClientIp(request), body: rawBody.slice(0, 2000) } });
    return NextResponse.json({ status: "error", error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try { body = JSON.parse(rawBody) as WebhookPayload; } catch {
    await logWebhook("invalid_json", "failed", { payload: { body: rawBody.slice(0, 2000) } });
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  // Community features removed — ignore group events and group messages
  if (body.event === "group-participants.update") {
    return NextResponse.json({ status: "ignored" });
  }

  // Only process incoming messages from here
  if (body.event !== "messages.upsert") {
    await logWebhook(String(body.event || "unknown"), "skipped", { payload: auditPayload(body) });
    return NextResponse.json({ status: "ignored" });
  }
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
    // Es el corte más silencioso de todos: si `extractMessageText` no reconoce
    // la forma del mensaje (viewOnce, ephemeral, string plano...) el bot no
    // responde y antes no quedaba registro de nada.
    await logWebhook("no_extractable_text", "skipped", { payload: { ...auditPayload(body), rawMessage: JSON.stringify(body?.data?.message ?? null).slice(0, 1500) } });
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
    await logWebhook("instance_not_found", "failed", { payload: { instance: instanceName, from: remoteJid } });
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

  // Plan resolution: admin = pro; otherwise from active subscriptions.
  // Ojo: `admin_id` es NOT NULL y siempre se suma al set, así que el chequeo
  // anterior (`size > 0`) daba "pro" SIEMPRE y el gate era un no-op.
  const adminUserId = adminRows?.[0]?.admin_id;
  const userIds = new Set<string>(assignments.map((a) => a.user_id));
  if (adminUserId) userIds.add(adminUserId);

  const planVotes: PlanType[] = [];
  if (userIds.size > 0) {
    const idList = [...userIds];
    const placeholders = idList.map(() => "?").join(",");
    const subs = await select<{ plan_type: string }>(
      `SELECT plan_type FROM subscriptions WHERE user_id IN (${placeholders}) AND status = 'active'`,
      idList,
    );
    for (const s of subs) {
      const p = s.plan_type as PlanType;
      if (p === "pro" || p === "starter") planVotes.push(p);
    }
  }
  // El dueño de la instancia siempre es pro.
  if (adminUserId) planVotes.push("pro");

  const userPlan: PlanType = planVotes.some((p) => p === "pro") ? "pro" : "starter";

  // OJO: en DMs, Evolution 2.3.5+ puede mandar el JID como <lid>@lid, que NO
  // es un teléfono. Si eso pasa, el `number` que le pasamos a sendText es un LID
  // y Evolution no lo entrega. Se deja el log con el número derivado para poder
  // confirmarlo en producción.
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");

  // Log DM messages that look like booking intents to diagnose plan resolution
  if (effectiveText && /(turno|agenda|agendar|reservar|cita)/i.test(effectiveText)) {
    console.log("[webhook] booking intent dm", {
      instance: instanceName,
      plan: userPlan,
      from: remoteJid,
      to: phoneNumber,
      isLid: remoteJid.endsWith("@lid"),
      text: effectiveText.slice(0, 40),
    });
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
    // BUG CRÍTICO: antes se inyectaba `{ query, pool: { execute: query } }`, un
    // objeto SIN `.from()`. Todos los handlers hacen `ctx.supabase.from(...)`,
    // así que reventaba con "ctx.supabase.from is not a function" → 500 y el bot
    // NUNCA respondía (ni "turno", ni auto-respuestas, ni menú, ni bienvenida).
    supabase: createSupabaseMariaDB(),
    instance, plan: userPlan, instanceName, remoteJid, phoneNumber,
    effectiveText, buttonText, listText,
    pushName: body.data?.pushName,
    messageId: body.data?.key?.id,
    senderJid: body.data?.key?.participant,
    rawButtonId: extractRawButtonId(body.data?.message) || undefined,
    autoResponses: autoResponses || [],
  };

  // Contexto de auditoría para `reply()`: identifica qué se procesó y si el
  // remitente vino como LID (que no es un teléfono y Evolution no lo entrega).
  const replyCtx = {
    instance: { id: instance.id },
    plan: userPlan,
    effectiveText,
    remoteJid,
    isLid: remoteJid.endsWith("@lid"),
  };

  // Plain-text menu navigation (Evolution 2.3.7 button fallback):
  // if a menu is active, "1"/"2"/"3" picks an option and "0"/"volver" goes back.
  // Runs before booking so numeric replies don't clash with the agenda.
  if (!buttonText && !listText) {
    const menuTextResult = await handleMenuTextReply(ctx);
    if (menuTextResult) return reply(menuTextResult, replyCtx);
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
      if (result) return reply(result, replyCtx);
    }

    // Slot selection: slot_<date>_<time>
    if (checkId.startsWith("slot_") && !checkId.startsWith("slots_more_")) {
      ctx.effectiveText = checkId;
      const result = await handleSlotSelect(ctx);
      if (result) return reply(result, replyCtx);
    }

    // Paginación del listado de horarios: slots_more_<date>_<offset>
    if (checkId.startsWith("slots_more_")) {
      ctx.effectiveText = checkId;
      const result = await handleSlotsMore(ctx);
      if (result) return reply(result, replyCtx);
    }

    // Numeric reply to a text menu (e.g. "2" for a slot previously shown)
    const numericResult = await handleNumericSlotSelect(ctx);
    if (numericResult) return reply(numericResult, replyCtx);

    // Date selection: date_<YYYY-MM-DD>
    if (checkId.startsWith("date_")) {
      ctx.effectiveText = checkId;
      const result = await handleDateSelect(ctx);
      if (result) return reply(result, replyCtx);
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
      if (result) return reply(result, replyCtx);
    }

    // Booking intent: "turno", "agendar", etc.
    const result = await handleBookingIntent(ctx);
    if (result) return reply(result, replyCtx);
  }

  // ============================================================
  // STARTER features: welcome, outside hours, menus, auto-reply
  // ============================================================

  // Welcome message (first-time writer)
  await handleWelcome(ctx);

  // Outside hours auto-reply (stops processing if triggered)
  const outsideResult = await handleOutsideHours(ctx);
  if (outsideResult) return reply(outsideResult, replyCtx);

  // Menu button/list tap
  if (buttonText || listText) {
    const menuResult = await handleMenuTap(ctx);
    if (menuResult) return reply(menuResult, replyCtx);
  }

  // ============================================================
  // CATALOG / Pedidos genéricos ( Starter + Pro )
  // ============================================================
  const catalogResult = await handleCatalogIntent(ctx);
  if (catalogResult) return reply(catalogResult, replyCtx);

  // Regular keyword/regex matching
  const replyResult = await handleAutoReply(ctx);
  return reply(replyResult, replyCtx);
}
