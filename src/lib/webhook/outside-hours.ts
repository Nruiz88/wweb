import { query } from "../db";
import { sendTextMessage } from "../evolution-multi";
import type { WebhookContext } from "./context";

/** Outside hours auto-reply.
 * Sends a message when the user writes outside business hours.
 * Requires: Starter plan
 */
export async function handleOutsideHours(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.outside_hours_message) return null;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const bizHours = await query<{ start_time: string; end_time: string }>(
    "SELECT start_time, end_time FROM business_hours WHERE instance_id = ? AND day_of_week = ? AND is_active = true LIMIT 1",
    [instance.id, dayOfWeek]
  );

  if (bizHours?.length) {
    const { start_time, end_time } = bizHours[0];
    let isOutside = false;
    if (start_time > end_time) {
      // Cross-midnight (e.g., 22:00-06:00)
      isOutside = nowTime < start_time && nowTime > end_time;
    } else {
      isOutside = nowTime < start_time || nowTime > end_time;
    }

    if (isOutside) {
      const outsideResult = await sendTextMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        instance.outside_hours_message, 1500,
      );
      try {
        await query(
          `INSERT INTO response_logs (id, instance_id, user_id, incoming_phone, incoming_message, matched_keyword, created_at)
           VALUES (?, ?, NULL, ?, ?, 'fuera de horario', NOW())`,
          [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)), instance.id, remoteJid, effectiveText]
        );
      } catch { /* non-critical */ }

      if (outsideResult.ok) {
        console.log("[webhook] fuera de horario", { instance: instanceName, from: remoteJid });
        return { status: "success", matched: "fuera de horario" };
      }
    }
  }

  return null;
}
