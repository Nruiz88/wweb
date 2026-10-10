import { query } from "../db";
import { sendTextMessage } from "../evolution-multi";
import { registrarRespuesta, type WebhookContext } from "./context";

/** Welcome message for first-time writers.
 * Sends a welcome message the first time a phone number messages this instance.
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleWelcome(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.welcome_message) return null;

  // Check if this phone already has a log (first-time writer)
  const existingLogs = await query<{ id: string }>(
    "SELECT id FROM bots_response_logs WHERE bot_id = ? AND incoming_phone = ? LIMIT 1",
    [instance.id, remoteJid]
  );

  if (existingLogs.length > 0) return null;

  const welcomeResult = await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, instance.welcome_message, 1500,
  );

  await registrarRespuesta(ctx, {
    telefono: remoteJid,
    mensaje: effectiveText,
    coincidencia: "bienvenida",
  });

  if (welcomeResult.ok) {
    console.log("[webhook] bienvenida enviada", { instance: instanceName, from: remoteJid });
  }

  return null; // Welcome never blocks the chain
}
