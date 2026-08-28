import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Handle confirm/cancel button taps from appointment reminders.
 * Button IDs: confirm_<apptId> or cancel_<apptId>
 * Requires: Pro plan
 */
export async function handleAppointmentConfirm(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;

  if (!effectiveText.startsWith("confirm_") && !effectiveText.startsWith("cancel_")) return null;

  const apptId = effectiveText.replace("confirm_", "").replace("cancel_", "");
  const newStatus = effectiveText.startsWith("confirm_") ? "confirmed" : "canceled";

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, customer_name, appointment_date, appointment_time")
    .eq("id", apptId)
    .single();

  if (!appt) return null;

  await supabase.from("appointments").update({ status: newStatus }).eq("id", apptId);

  const dateStr = formatDateStr(appt.appointment_date);
  const [h, m] = appt.appointment_time.split(":");
  const emoji = newStatus === "confirmed" ? "✅" : "❌";
  const text = newStatus === "confirmed" ? "confirmado" : "cancelado";

  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `${emoji} Turno ${text} para ${dateStr} a las ${h}:${m}.${newStatus === "confirmed" ? " ¡Te esperamos!" : " Si necesitas otro turno, escribime."}`,
    1500,
  );
  return { status: "success", matched: `[turno ${newStatus}]` };
}

/**
 * Handle time slot selection from appointment booking.
 * Button ID: slot_<YYYY-MM-DD>_<HH:MM>
 * Requires: Pro plan
 */
export async function handleSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, pushName } = ctx;

  if (!effectiveText.startsWith("slot_")) return null;

  const parts = effectiveText.replace("slot_", "");
  const lastUnderscore = parts.lastIndexOf("_");
  const slotDate = parts.slice(0, lastUnderscore);
  const slotTime = parts.slice(lastUnderscore + 1);

  // Check conflict
  const { data: conflict } = await supabase
    .from("appointments")
    .select("id")
    .eq("instance_id", instance.id)
    .eq("appointment_date", slotDate)
    .eq("appointment_time", slotTime)
    .in("status", ["pending", "confirmed"])
    .limit(1);

  if (conflict && conflict.length > 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      '❌ Ese horario ya fue tomado. Escribí "turno" para ver otros disponibles.',
      1500,
    );
    return { status: "success", matched: "[turno ocupado]" };
  }

  // Create appointment
  const { data: newAppt } = await supabase
    .from("appointments")
    .insert({
      instance_id: instance.id,
      customer_phone: remoteJid,
      customer_name: pushName || null,
      appointment_date: slotDate,
      appointment_time: slotTime,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (newAppt) {
    const dateStr = formatDateStr(slotDate);
    const [h, m] = slotTime.split(":");
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      `✅ ¡Turno agendado!\n\n📅 ${dateStr} a las ${h}:${m}\n\nTe enviaremos un recordatorio 24 horas antes. ¡Nos vemos!`,
      1500,
    );
    return { status: "success", matched: "[turno agendado]" };
  }

  return null;
}

/**
 * Handle date selection from appointment booking.
 * Button ID: date_<YYYY-MM-DD>
 * Requires: Pro plan
 */
export async function handleDateSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;

  if (!effectiveText.startsWith("date_")) return null;

  const slotDate = effectiveText.replace("date_", "");
  const dateObj = new Date(slotDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const { data: hours } = await supabase
    .from("business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("instance_id", instance.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ No hay horarios disponibles para ese día.",
      1500,
    );
    return { status: "success", matched: "[turno sin horarios]" };
  }

  // Generate slots
  const [sh, sm] = hours.start_time.split(":").map(Number);
  const [eh, em] = hours.end_time.split(":").map(Number);
  const dur = hours.slot_duration_min;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const { data: booked } = await supabase
    .from("appointments")
    .select("appointment_time")
    .eq("instance_id", instance.id)
    .eq("appointment_date", slotDate)
    .in("status", ["pending", "confirmed"]);

  const bookedSet = new Set((booked || []).map((b) => b.appointment_time));

  const now = new Date();
  const isToday = slotDate === now.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const availableSlots: string[] = [];
  for (let m = startMin; m + dur <= endMin; m += dur) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (bookedSet.has(time)) continue;
    if (isToday && h * 60 + min <= nowMinutes) continue;
    availableSlots.push(time);
  }

  if (availableSlots.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      '❌ No hay horarios disponibles para ese día. Escribí "turno" para ver otros días.',
      1500,
    );
    return { status: "success", matched: "[turno sin slots]" };
  }

  const dateStr = formatDateStr(slotDate);
  const timeButtons: ButtonItem[] = availableSlots.slice(0, 3).map((t) => ({
    type: "reply",
    reply: { id: `slot_${slotDate}_${t}`, title: t },
  }));

  await sendButtonMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `Horarios disponibles - ${dateStr}`,
    "Elegí un horario:",
    timeButtons,
    undefined,
    1500,
  );
  return { status: "success", matched: "[turno selección hora]" };
}

/**
 * Handle "turno" keyword: show available dates.
 * Requires: Pro plan
 */
export async function handleBookingIntent(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;

  const bookingKeywords = ["turno", "agendar", "reservar", "cita", "appointment"];
  const isBooking = bookingKeywords.some((k) => effectiveText.toLowerCase().includes(k));

  if (!isBooking) return null;

  const { data: bizHours } = await supabase
    .from("business_hours")
    .select("day_of_week")
    .eq("instance_id", instance.id)
    .eq("is_active", true);

  if (!bizHours || bizHours.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, la agenda no está configurada todavía. Escribí más tarde.",
      1500,
    );
    return { status: "success", matched: "[turno sin agenda]" };
  }

  const activeDays = new Set(bizHours.map((h) => h.day_of_week));
  const now = new Date();
  const daysShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dates: { display: string; id: string }[] = [];

  let checkDate = new Date(now);
  checkDate.setDate(checkDate.getDate() + 1);

  while (dates.length < 5) {
    const dow = checkDate.getDay();
    if (activeDays.has(dow)) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      const display = `${daysShort[dow]} ${checkDate.getDate()} ${MONTHS[checkDate.getMonth()]}`;
      dates.push({ display, id: `date_${dateStr}` });
    }
    checkDate.setDate(checkDate.getDate() + 1);
    if (dates.length === 0 && checkDate.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) break;
  }

  if (dates.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "No encontré disponibilidad en los próximos días.",
      1500,
    );
    return { status: "success", matched: "[turno sin disponibilidad]" };
  }

  const dateButtons: ButtonItem[] = dates.map((d) => ({
    type: "reply",
    reply: { id: d.id, title: d.display },
  }));

  await sendButtonMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "📅 Elegí un día para tu turno:",
    "",
    dateButtons,
    undefined,
    1500,
  );
  return { status: "success", matched: "[turno selección día]" };
}
