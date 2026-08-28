import { sendTextMessage } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";

/**
 * Outside hours auto-reply.
 * Sends a message when the user writes outside business hours.
 * Requires: Starter plan
 */
export async function handleOutsideHours(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.outside_hours_message) return null;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const { data: bizHours } = await supabase
    .from("business_hours")
    .select("start_time, end_time")
    .eq("instance_id", instance.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (bizHours) {
    const { start_time, end_time } = bizHours;
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
        await supabase.from("response_logs").insert({
          instance_id: instance.id,
          user_id: null,
          incoming_phone: remoteJid,
          incoming_message: effectiveText,
          matched_keyword: "[fuera de horario]",
        });
      } catch { /* non-critical */ }

      if (outsideResult.ok) {
        console.log("[webhook] fuera de horario", { instance: instanceName, from: remoteJid });
        return { status: "success", matched: "[fuera de horario]" };
      }
    }
  }

  return null;
}
