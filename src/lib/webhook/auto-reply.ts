import { query, generateId } from "../db";
import { sendTextMessage } from "../evolution-multi";
import { isWithinSchedule, matchKeyword, matchRegex } from "../webhook-matching";
import { sendMenuResponse } from "./menus";
import { registrarRespuesta, type WebhookContext } from "./context";

/** Regular keyword/regex auto-reply matching.
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleAutoReply(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  const autoResponses = ctx.autoResponses;
  if (!autoResponses || autoResponses.length === 0) return { status: "no_match" as const };

  let matched: any = null;
  let matchedKeyword = "";

  for (const ar of autoResponses) {
    if (!isWithinSchedule(ar.schedule)) continue;

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

  // Un menú que matchea por keyword se DIBUJA. Antes había un
  // `if (ar.response_type === "menu") continue` que hacía los menús
  // inalcanzables: solo se entraba a un menu tocando un botón de otro menu,
  // y como los botones tampoco llegan (viewOnce), los menus interactivos
  // eran inalcanzables por completo.
  if (matched.response_type === "menu" && matched.menu_config) {
    const ok = await sendMenuResponse(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      phoneNumber,
      matched.menu_config,
    );
    if (!ok) return { status: "error" as const, error: "No se pudo enviar el menú" };
    try {
      await logMatch(ctx, matched, remoteJid, effectiveText, matchedKeyword);
    } catch { /* non-critical */ }
    return { status: "success" as const, matched: matchedKeyword, response: "[menú]" };
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
    await logMatch(ctx, matched, remoteJid, effectiveText, matchedKeyword);
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

  /** Registra el match en el histórico. */
  async function logMatch(
    ctx: WebhookContext,
    ar: { id: string },
    remoteJid: string,
    incomingMessage: string,
    keyword: string,
  ) {
    await registrarRespuesta(ctx, {
      respuestaId: ar.id,
      telefono: remoteJid,
      mensaje: incomingMessage,
      coincidencia: keyword,
    });
  }
