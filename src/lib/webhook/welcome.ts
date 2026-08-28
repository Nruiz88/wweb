import { sendTextMessage } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";

/**
 * Welcome message for first-time writers.
 * Sends a welcome message the first time a phone number messages this instance.
 * Requires: Starter plan
 */
export async function handleWelcome(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.welcome_message) return null;

  const { data: existingLog } = await supabase
    .from("response_logs")
    .select("id")
    .eq("instance_id", instance.id)
    .eq("incoming_phone", remoteJid)
    .limit(1);

  if (!existingLog || existingLog.length === 0) {
    const welcomeResult = await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber, instance.welcome_message, 1500,
    );

    try {
      await supabase.from("response_logs").insert({
        instance_id: instance.id,
        user_id: null,
        incoming_phone: remoteJid,
        incoming_message: effectiveText,
        matched_keyword: "[bienvenida]",
      });
    } catch { /* non-critical */ }

    if (welcomeResult.ok) {
      console.log("[webhook] bienvenida enviada", { instance: instanceName, from: remoteJid });
      // Continue processing (welcome doesn't block auto-responses)
    }
  }

  return null; // Welcome never blocks the chain
}
