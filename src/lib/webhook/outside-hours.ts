import { query } from "../db";
import { sendTextMessage } from "../evolution-multi";
import { BUSINESS_TIMEZONE } from "../timezone";
import { registrarRespuesta, type WebhookContext } from "./context";

/** Outside hours auto-reply.
 * Sends a message when the user writes outside business hours.
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleOutsideHours(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!instance.outside_hours_message) return null;

  // La hora del SERVIDOR es UTC (Coolify/Vercel), no la del negocio: con
  // BUSINESS_TIMEZONE=America/Argentina/Buenos_Aires el mensaje salía hasta
  // 3h tarde. Se usa Intl con la zona del negocio.
  const now = new Date();
  const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
  }).format(now);
  const dayOfWeek = WEEKDAY_INDEX[weekday] ?? now.getDay();
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  const bizHours = await query<{ start_time: string; end_time: string }>(
    "SELECT start_time, end_time FROM bots_business_hours WHERE bot_id = ? AND day_of_week = ? AND is_active = true LIMIT 1",
    [instance.id, dayOfWeek]
  );

  if (bizHours?.length) {
    const { start_time, end_time } = bizHours[0];
    let isOutside = false;
    if (start_time > end_time) {
      // Cruza medianoche (ej. 22:00-06:00): está DENTRO entre end y start.
      // Antes era `now < start && now > end`, imposible de cumplir.
      isOutside = nowTime < end_time || nowTime > start_time;
    } else {
      isOutside = nowTime < start_time || nowTime > end_time;
    }

    if (isOutside) {
      const outsideResult = await sendTextMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        instance.outside_hours_message, 1500,
      );
      await registrarRespuesta(ctx, {
        telefono: remoteJid,
        mensaje: effectiveText,
        coincidencia: "fuera de horario",
      });

      if (outsideResult.ok) {
        console.log("[webhook] fuera de horario", { instance: instanceName, from: remoteJid });
        return { status: "success", matched: "fuera de horario" };
      }
    }
  }

  return null;
}
