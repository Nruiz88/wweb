import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhook-secret";
import { extractMessageText, extractButtonText, extractListText, extractRawButtonId } from "@/lib/webhook/extract";
import { hasPlan, type WebhookContext } from "@/lib/webhook/context";
import { handleGroupWelcome } from "@/lib/webhook/group-welcome";
import { handleGroupSpam } from "@/lib/webhook/group-spam";
import { handleWelcome } from "@/lib/webhook/welcome";
import { handleOutsideHours } from "@/lib/webhook/outside-hours";
import { handleBookingIntent, handleDateSelect, handleSlotSelect, handleAppointmentConfirm, handleAgendaMenu } from "@/lib/webhook/booking";
import { handleMenuTap } from "@/lib/webhook/menus";
import { handleAutoReply } from "@/lib/webhook/auto-reply";
import type { PlanType } from "@/lib/supabase/types";

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

const PLAN_HIERARCHY: PlanType[] = ["starter", "pro", "community"];

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

  const supabase = await createServerClient();

  // ============================================================
  // GROUP-PARTICIPANTS.UPDATE → Community feature + auto-capture
  // ============================================================
  if (body.event === "group-participants.update") {
    const groupJid = body.data?.id;
    const participantJid = body.data?.participant;
    const action = body.data?.action;

    if (!groupJid || !participantJid) {
      return NextResponse.json({ status: "ignored" });
    }

    // Find instance
    const { data: instance } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key")
      .eq("instance_name", body.instance)
      .single();

    if (!instance) {
      return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
    }

    // Auto-capture: store discovered group (upsert updates last_seen_at)
    if (groupJid.endsWith("@g.us")) {
      const { data: existingGrp } = await supabase
        .from("group_settings")
        .select("id")
        .eq("instance_id", instance.id)
        .eq("group_jid", groupJid)
        .maybeSingle();

      // Only auto-capture if not already configured
      if (!existingGrp) {
        await supabase
          .from("discovered_groups")
          .upsert({
            instance_id: instance.id,
            group_jid: groupJid,
            last_seen_at: new Date().toISOString(),
          }, { onConflict: "instance_id,group_jid" });
      }
    }

    if (action !== "add") {
      return NextResponse.json({ status: "ignored" });
    }

    const plan = await getPlanForInstance(supabase, instance.id);

    // Community feature: group welcome
    if (hasPlan(plan, "community")) {
      const result = await handleGroupWelcome({
        supabase, instanceName: body.instance, groupJid, participantJid, action, bodyInstance: body.instance,
      });
      if (result) return NextResponse.json(result);
    }

    return NextResponse.json({ status: "ignored" });
  }

  // Only process incoming messages from here
  if (body.event !== "messages.upsert") return NextResponse.json({ status: "ignored" });
  if (body.data?.key?.fromMe) return NextResponse.json({ status: "ignored" });

  const instanceName = body.instance;
  const remoteJid = body.data?.key?.remoteJid || "";
  const plainText = extractMessageText(body.data?.message);
  const buttonText = extractButtonText(body.data?.message);
  const listText = extractListText(body.data?.message);
  const effectiveText = plainText || buttonText || listText;

  if (!instanceName || !remoteJid || !effectiveText) {
    return NextResponse.json({ status: "ignored" });
  }

  // ============================================================
  // GROUP MESSAGES → Community feature (spam filter) + auto-capture
  // ============================================================
  if (remoteJid.includes("@g.us")) {
    const { data: grpInstance } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key")
      .eq("instance_name", instanceName)
      .single();

    if (!grpInstance) {
      return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
    }

    // Auto-capture: track active groups
    const { data: existingGrp } = await supabase
      .from("group_settings")
      .select("id")
      .eq("instance_id", grpInstance.id)
      .eq("group_jid", remoteJid)
      .maybeSingle();

    if (!existingGrp) {
      // Track active groups (name is filled later by fetchAllGroups sync)
      await supabase
        .from("discovered_groups")
        .upsert({
          instance_id: grpInstance.id,
          group_jid: remoteJid,
          last_seen_at: new Date().toISOString(),
        }, { onConflict: "instance_id,group_jid" });
    }

    const plan = await getPlanForInstance(supabase, grpInstance.id);

    if (hasPlan(plan, "community")) {
      const result = await handleGroupSpam({
        supabase, instanceName, remoteJid, plainText,
        msgId: body.data?.key?.id,
        senderJid: body.data?.key?.participant || remoteJid,
        bodyInstance: instanceName,
      });
      if (result) return NextResponse.json(result);
    }

    return NextResponse.json({ status: "ignored" });
  }

  // ============================================================
  // DM MESSAGES → load instance + plan + shared context
  // ============================================================
  const { data: instance } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key, welcome_message, outside_hours_message")
    .eq("instance_name", instanceName)
    .single();

  if (!instance) {
    console.error("[webhook] instancia no encontrada", { instance: instanceName, from: remoteJid });
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const plan = await getPlanForInstance(supabase, instance.id);
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");

  // Log DM messages that look like booking intents to diagnose plan resolution
  if (effectiveText && /(turno|agenda|agendar|reservar|cita)/i.test(effectiveText)) {
    console.log("[webhook] booking intent dm", { instance: instanceName, plan, from: remoteJid, text: effectiveText.slice(0, 40) });
  }

  // Pre-fetch auto-responses (shared across handlers)
  const { data: autoResponses } = await supabase
    .from("auto_responses")
    .select("id, keyword, regex_pattern, response_type, menu_config, response_text, response_media_url, priority, schedule, user_id")
    .eq("instance_id", instance.id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  // Build shared context
  const ctx: WebhookContext = {
    supabase, instance, plan, instanceName, remoteJid, phoneNumber,
    effectiveText, buttonText, listText,
    pushName: body.data?.pushName,
    messageId: body.data?.key?.id,
    senderJid: body.data?.key?.participant,
    autoResponses: autoResponses || [],
  };

  // ============================================================
  // PRO features: appointment booking flow
  // ============================================================
  if (hasPlan(plan, "pro")) {
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

    // Date selection: date_<YYYY-MM-DD>
    if (checkId.startsWith("date_")) {
      ctx.effectiveText = checkId;
      const result = await handleDateSelect(ctx);
      if (result) return NextResponse.json(result);
    }

    // Agenda menu: agenda_hoy / agenda_proximo / agenda_completa
    if (checkId === "agenda_hoy" || checkId === "agenda_proximo" || checkId === "agenda_completa") {
      ctx.effectiveText = checkId;
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

  // Regular keyword/regex matching
  const replyResult = await handleAutoReply(ctx);
  return NextResponse.json(replyResult);
}

/** Look up the subscription plan for an instance */
async function getPlanForInstance(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  instanceId: string,
): Promise<PlanType> {
  const hierarchy: PlanType[] = ["starter", "pro", "community"];
  let best: PlanType = "starter";

  const resolveUserPlan = async (userId: string | undefined | null) => {
    if (!userId) return;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_type")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const plan = (sub?.plan_type as PlanType | undefined);
    if (plan && hierarchy.indexOf(plan) > hierarchy.indexOf(best)) {
      best = plan;
    }
  };

  // All assigned users
  const { data: assignments } = await supabase
    .from("user_instances")
    .select("user_id")
    .eq("instance_id", instanceId);
  for (const a of assignments || []) {
    await resolveUserPlan(a.user_id);
  }

  // Instance admin (owner) always counts
  const { data: instance } = await supabase
    .from("instances")
    .select("admin_id")
    .eq("id", instanceId)
    .single();
  await resolveUserPlan(instance?.admin_id);

  return best;
}
