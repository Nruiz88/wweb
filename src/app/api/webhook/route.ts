import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendTextMessage } from "@/lib/evolution-multi";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhook-secret";
import { isWithinSchedule, matchKeyword, matchRegex } from "@/lib/webhook-matching";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  event: string;
  instance: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: Record<string, unknown>;
    pushName?: string;
    messageTimestamp?: number;
  };
}

function extractMessageText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";

  // conversation (simple text)
  if (typeof message.conversation === "string") return message.conversation;

  // extendedTextMessage
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string") return ext.text;

  // imageMessage, videoMessage, documentMessage, audioMessage (captions)
  const mediaKeys = ["imageMessage", "videoMessage", "documentMessage", "audioMessage"];
  for (const key of mediaKeys) {
    const media = message[key] as Record<string, unknown> | undefined;
    if (typeof media?.caption === "string") return media.caption;
  }

  return "";
}

export async function POST(request: Request) {
  // Rate limit: 100 requests per minute per IP
  const rateLimitErr = await rateLimitResponse(request, "webhook", { maxRequests: 100, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  // Read the raw body ONCE (needed for both HMAC verification and JSON parse)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 });
  }

  // Verify webhook signature
  if (!(await verifyWebhookSignature(request, rawBody))) {
    console.warn("[webhook] firma invalida", { ip: getClientIp(request) });
    return NextResponse.json({ status: "error", error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookPayload;

  try {
    body = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  // Only process incoming messages
  if (body.event !== "messages.upsert") {
    return NextResponse.json({ status: "ignored" });
  }

  // Skip messages sent by us
  if (body.data?.key?.fromMe) {
    return NextResponse.json({ status: "ignored" });
  }

  const instanceName = body.instance;
  const remoteJid = body.data?.key?.remoteJid;
  const messageText = extractMessageText(body.data?.message);

  if (!instanceName || !remoteJid || !messageText) {
    return NextResponse.json({ status: "ignored" });
  }

  // Don't respond to group messages
  if (remoteJid.includes("@g.us")) {
    return NextResponse.json({ status: "ignored" });
  }

  const supabase = await createServerClient();

  // Find the instance
  const { data: instance } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key")
    .eq("instance_name", instanceName)
    .single();

  if (!instance) {
    console.error("[webhook] instancia no encontrada", { instance: instanceName, from: remoteJid });
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Get active auto-responses for this instance, ordered by priority
  const { data: autoResponses } = await supabase
    .from("auto_responses")
    .select("id, keyword, regex_pattern, response_text, response_media_url, priority, schedule, user_id")
    .eq("instance_id", instance.id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (!autoResponses || autoResponses.length === 0) {
    return NextResponse.json({ status: "no_match" });
  }

  // Find the first matching auto-response
  let matched = null;
  let matchedKeyword = "";

  for (const ar of autoResponses) {
    // Check schedule
    if (!isWithinSchedule(ar.schedule)) continue;

    // Check keyword match
    if (ar.keyword && matchKeyword(messageText, ar.keyword)) {
      matched = ar;
      matchedKeyword = ar.keyword;
      break;
    }

    // Check regex match
    if (ar.regex_pattern && matchRegex(messageText, ar.regex_pattern)) {
      matched = ar;
      matchedKeyword = ar.regex_pattern;
      break;
    }
  }

  if (!matched) {
    console.log("[webhook] sin match", { instance: instanceName, from: remoteJid, text: messageText.slice(0, 120) });
    return NextResponse.json({ status: "no_match" });
  }

  // Send the auto-response via Evolution API
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");
  const sendResult = await sendTextMessage(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    phoneNumber,
    matched.response_text,
    1500 // 1.5s delay to seem natural
  );

  // Log the response (don't fail if logging fails)
  try {
    await supabase.from("response_logs").insert({
      instance_id: instance.id,
      auto_response_id: matched.id,
      user_id: matched.user_id,
      incoming_phone: remoteJid,
      incoming_message: messageText,
      matched_keyword: matchedKeyword,
    });
  } catch (logErr) {
    console.error("[webhook] error guardando log", { instance: instanceName, error: logErr });
  }

  if (sendResult.ok) {
    console.log("[webhook] respuesta enviada", {
      instance: instanceName,
      from: remoteJid,
      keyword: matchedKeyword,
      ok: true,
    });
    return NextResponse.json({
      status: "success",
      matched: matchedKeyword,
      response: matched.response_text,
    });
  }

  console.error("[webhook] error enviando respuesta", {
    instance: instanceName,
    from: remoteJid,
    keyword: matchedKeyword,
    message: sendResult.message,
  });
  return NextResponse.json(
    { status: "error", error: sendResult.message },
    { status: 500 }
  );
}
