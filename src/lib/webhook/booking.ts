import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Generate HH:MM slots between start and end given a duration. */
function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  for (let m = startMin; m + durationMin <= endMin; m += durationMin) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

/** Fetch available slots for a date (excludes booked + past times). */
async function getAvailableSlots(
  ctx: WebhookContext,
  date: string,
): Promise<{ slots: string[]; hours: { start_time: string; end_time: string; slot_duration_min: number } | null }> {
  const { supabase, instance } = ctx;
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const { data: hours } = await supabase
    .from("business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("instance_id", instance.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) return { slots: [], hours: null };

  const all = generateSlots(hours.start_time, hours.end_time, hours.slot_duration_min);

  const { data: booked } = await supabase
    .from("appointments")
    .select("appointment_time")
    .eq("instance_id", instance.id)
    .eq("appointment_date", date)
    .in("status", ["pending", "confirmed"]);

  const bookedSet = new Set((booked || []).map((b) => b.appointment_time));

  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slots = all.filter((t) => {
    if (bookedSet.has(t)) return false;
    if (isToday) {
      const [h, m] = t.split(":").map(Number);
      if (h * 60 + m <= nowMinutes) return false;
    }
    return true;
  });

  return { slots, hours };
}

/**
 * Agenda menu dispatcher: agenda_hoy / agenda_proximo / agenda_completa,
 * or shows the menu itself when no specific option was tapped.
 */
export async function handleAgendaMenu(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;

  if (effectiveText === "agenda_hoy") {
    return handleAgendaHoy(ctx);
  }
  if (effectiveText === "agenda_proximo") {
    return handleAgendaProximo(ctx);
  }
  if (effectiveText === "agenda_completa") {
    return handleAgendaCompleta(ctx);
  }

  const { instance, phoneNumber } = ctx;
  const menuButtons: ButtonItem[] = [
    { type: "reply", displayText: "🕐 Libre hoy", id: "agenda_hoy" },
    { type: "reply", displayText: "⏭️ Libre más próximo", id: "agenda_proximo" },
    { type: "reply", displayText: "📅 Agenda completa", id: "agenda_completa" },
  ];

  await sendButtonMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "🗓️ ¿Qué querés ver?",
    "Elegí una opción:",
    menuButtons,
    undefined,
    1500,
  );
  return { status: "success", matched: "[turno menú agenda]" };
}

/** Agenda hoy: muestra los horarios libres de hoy con botones de slot. */
async function handleAgendaHoy(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const today = new Date().toISOString().slice(0, 10);
  const { slots, hours } = await getAvailableSlots(ctx, today);

  if (!hours) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ Hoy no hay horarios configurados. Tocá 📅 Agenda completa para ver otros días.",
      1500,
    );
    return { status: "success", matched: "[turno hoy sin agenda]" };
  }

  if (slots.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ Hoy no quedan horarios libres. Probá con ⏭️ Libre más próximo o 📅 Agenda completa.",
      1500,
    );
    return { status: "success", matched: "[turno hoy sin slots]" };
  }

  const dateStr = formatDateStr(today);
  const list = slots.map((t) => `• ${t}`).join("\n");
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `🕐 Horarios libres HOY (${dateStr}):\n\n${list}\n\nTocá uno para reservar:`,
    1500,
  );

  const slotButtons: ButtonItem[] = slots.slice(0, 3).map((t) => ({
    type: "reply",
    displayText: t,
    id: `slot_${today}_${t}`,
  }));

  await sendButtonMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `Horarios libres - ${dateStr}`,
    "Elegí un horario:",
    slotButtons,
    undefined,
    1500,
  );
  return { status: "success", matched: "[turno hoy]" };
}

/** Agenda más próximo: busca el siguiente día hábil con horarios libres. */
async function handleAgendaProximo(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;

  const now = new Date();
  let found = false;
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const { slots, hours } = await getAvailableSlots(ctx, dateStr);
    if (slots.length > 0) {
      const dateStr2 = formatDateStr(dateStr);
      const list = slots.map((t) => `• ${t}`).join("\n");
      await sendTextMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        `⏭️ Próximo día con horarios libres: ${dateStr2}\n\n${list}\n\nTocá uno para reservar:`,
        1500,
      );
      const slotButtons: ButtonItem[] = slots.slice(0, 3).map((t) => ({
        type: "reply",
        displayText: t,
        id: `slot_${dateStr}_${t}`,
      }));
      await sendButtonMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        `Horarios libres - ${dateStr2}`,
        "Elegí un horario:",
        slotButtons,
        undefined,
        1500,
      );
      found = true;
      break;
    }
    void hours;
    if (i === 14 && !found) break;
  }

  if (!found) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "No encontré disponibilidad en los próximos 14 días. Escribí más tarde.",
      1500,
    );
  }
  return { status: "success", matched: "[turno próximo]" };
}

/** Agenda completa: envía el link público de agendado (referenciando al usuario). */
async function handleAgendaCompleta(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber } = ctx;
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, la agenda completa aún no está disponible. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  // Resolve the owner user (the business) so the link references their agenda.
  const { data: inst } = await supabase
    .from("instances")
    .select("admin_id")
    .eq("id", instance.id)
    .single();

  if (!inst?.admin_id) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", inst.admin_id)
    .single();

  if (!owner?.email) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  const link = `${baseUrl}/agendar?user=${encodeURIComponent(owner.email)}`;
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `📅 Mirá toda la disponibilidad y reservá acá:\n\n${link}`,
    1500,
  );
  return { status: "success", matched: "[turno agenda completa]" };
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

  // UUID validation to prevent crafted IDs
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apptId)) {
    return null;
  }

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, instance_id, customer_name, appointment_date, appointment_time")
    .eq("id", apptId)
    .single();

  if (!appt) return null;

  // Authorization: only confirm/cancel appointments belonging to this instance
  if (appt.instance_id !== instance.id) return null;

  await supabase.from("appointments").update({ status: newStatus }).eq("id", apptId).eq("instance_id", instance.id);

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

  // Validate date/time format to prevent injection
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return null;
  }

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
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) return null;
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
    displayText: t,
    id: `slot_${slotDate}_${t}`,
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
 * Handle "turno" keyword: show the agenda menu (hoy / próximo / completa).
 * Requires: Pro plan
 */
export async function handleBookingIntent(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;

  const bookingKeywords = ["turno", "agendar", "reservar", "cita", "appointment"];
  const isBooking = bookingKeywords.some((k) => effectiveText.toLowerCase().includes(k));

  if (!isBooking) return null;

  // Verify the agenda is configured at all before offering options
  const { supabase, instance } = ctx;
  const { data: bizHours } = await supabase
    .from("business_hours")
    .select("id")
    .eq("instance_id", instance.id)
    .eq("is_active", true)
    .limit(1);

  if (!bizHours || bizHours.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, ctx.phoneNumber,
      "Lo siento, la agenda no está configurada todavía. Escribí más tarde.",
      1500,
    );
    return { status: "success", matched: "[turno sin agenda]" };
  }

  return handleAgendaMenu(ctx);
}
