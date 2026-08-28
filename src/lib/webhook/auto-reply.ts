import { sendTextMessage } from "@/lib/evolution-multi";
import { isWithinSchedule, matchKeyword, matchRegex } from "@/lib/webhook-matching";
import type { WebhookContext } from "./context";

/**
 * Regular keyword/regex auto-reply matching.
 * The core feature of the Starter plan.
 * Requires: Starter plan
 */
export async function handleAutoReply(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  const autoResponses = ctx.autoResponses;
  if (!autoResponses || autoResponses.length === 0) return { status: "no_match" as const };

  let matched = null;
  let matchedKeyword = "";

  for (const ar of autoResponses) {
    if (!isWithinSchedule(ar.schedule)) continue;
    if (ar.response_type === "menu") continue; // menus respond to button taps, not text

    if (ar.keyword && matchKeyword(effectiveText, ar.keyword)) {
      matched = ar;
      matchedKeyword = ar.keyword;
      break;
    }

    if (ar.regex_pattern && matchRegex(effectiveText, ar.regex_pattern)) {
      matched = ar;
      matchedKeyword = ar.regex_pattern;
      break;
    }
  }

  if (!matched) {
    console.log("[webhook] sin match", { instance: instanceName, from: remoteJid, text: effectiveText.slice(0, 120) });
    return { status: "no_match" as const };
  }

  const sendResult = await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, matched.response_text, 1500,
  );

  if (!sendResult.ok) {
    console.error("[webhook] error enviando respuesta", {
      instance: instanceName, from: remoteJid, keyword: matchedKeyword, message: sendResult.message,
    });
    return { status: "error" as const, error: sendResult.message };
  }

  try {
    await supabase.from("response_logs").insert({
      instance_id: instance.id,
      auto_response_id: matched.id,
      user_id: matched.user_id,
      incoming_phone: remoteJid,
      incoming_message: effectiveText,
      matched_keyword: matchedKeyword,
    });
  } catch (logErr) {
    console.error("[webhook] error guardando log", { instance: instanceName, error: logErr });
  }

  console.log("[webhook] respuesta enviada", { instance: instanceName, from: remoteJid, keyword: matchedKeyword, ok: true });
  return {
    status: "success",
    matched: matchedKeyword,
    response: matched.response_type === "menu" ? "[menú]" : matched.response_text,
  };
}
