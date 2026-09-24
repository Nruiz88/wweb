import { query } from "../db";
import { sendTextMessage } from "../evolution-multi";
import type { WebhookContext } from "./context";

/** Welcome message for first-time writers.
 * Sends a welcome message the first time a phone number messages this instance.
 * Requires: Starter plan
 */
export async function handleWelcome(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.welcome_message) return null;

  // Check if this phone already has a log (first-time writer)
  const [{ rows: existingLogs }] = await query<{ id: string }>(
    "SELECT id FROM response_logs WHERE instance_id = ? AND incoming_phone = ? LIMIT 1",
    [instance.id, remoteJid]
  );

  if (existingLogs.length > 0) return null;

  const welcomeResult = await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, instance.welcome_message, 1500,
  );

  try {
    await query(
      `INSERT INTO response_logs (id, instance_id, user_id, incoming_phone, incoming_message, matched_keyword, created_at)
       VALUES (?, ?, NULL, ?, ?, 'bienvenida', NOW())`,
      [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), instance.id, remoteJid, effectiveText]
    );
  } catch { /* non-critical */ }

  if (welcomeResult.ok) {
    console.log("[webhook] bienvenida enviada", { instance: instanceName, from: remoteJid });
  }

  return null; // Welcome never blocks the chain
}
