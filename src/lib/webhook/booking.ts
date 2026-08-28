import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";
import { slugify } from "@/lib/slug";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Business timezone. Vercel functions run in UTC, so "today"/"now" must be
// computed in the business's local time or the "Libre hoy" filter will drop
// valid afternoon slots (server is 3h ahead of Argentina). Configurable via
// BUSINESS_TIMEZONE env; defaults to Buenos Aires.
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "America/Argentina/Buenos_Aires";

function localDateStr(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function localTimeMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

// In-memory state: remember the date shown to a user so that when they reply
// with a slot number ("1", "2"...) we know which date to book. Keyed by
// instance:phone. Note: ephemeral across serverless restarts; used only to
// bridge the immediate follow-up message.
const pendingDate = new Map<string, string>();
const PENDING_TTL_MS = 10 * 60 * 1000;

// In-memory agenda session: true mientras el usuario navega el menú de agenda
// (turno → 1/2/3 → slot). Se limpia al AGENDAR un turno para que el flujo
// termine: un número posterior ya no debe re-disparar el menú de agenda; para
// volver a empezar hay que escribir la palabra clave ("turno", "agendar"...).
const agendaActive = new Map<string, boolean>();
const AGENDA_TTL_MS = 15 * 60 * 1000;

function agendaKey(ctx: WebhookContext): string {
  return `${ctx.instance.id}:${ctx.remoteJid}`;
}

function markAgendaActive(ctx: WebhookContext): void {
  const key = agendaKey(ctx);
  agendaActive.set(key, true);
  setTimeout(() => agendaActive.delete(key), AGENDA_TTL_MS);
}

function clearAgendaActive(ctx: WebhookContext): void {
  agendaActive.delete(agendaKey(ctx));
}

/** True si el usuario está dentro del flujo de agenda (menú visible). */
export function isAgendaActive(ctx: WebhookContext): boolean {
  return agendaActive.get(agendaKey(ctx)) === true;
}

function rememberDate(ctx: WebhookContext, date: string): void {
  const key = agendaKey(ctx);
  pendingDate.set(key, date);
  setTimeout(() => pendingDate.delete(key), PENDING_TTL_MS);
}

function peekPendingDate(ctx: WebhookContext): string | null {
  return pendingDate.get(agendaKey(ctx)) ?? null;
}

function getPendingDate(ctx: WebhookContext): string | null {
  const key = agendaKey(ctx);
  const date = pendingDate.get(key) ?? null;
  if (date) pendingDate.delete(key);
  return date;
}

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
  const todayStr = localDateStr(now);
  const isToday = date === todayStr;
  const nowMinutes = localTimeMinutes(now);

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
 *
 * Uses plain-text numbered menus (NOT interactive buttons) because
 * Evolution 2.3.7 has a bug where sendButtons/sendList fail
 * (EvolutionAPI#2390, "this.isZero is not a function").
 */
export async function handleAgendaMenu(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;

  // Mientras se muestra cualquier opción del menú de agenda, la sesión está
  // activa (permite responder con 1/2/3 o con un número de horario).
  markAgendaActive(ctx);

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
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "🗓️ *¿Qué querés ver?*\n\n" +
      "1️⃣ 🕐 *Libre hoy*\n" +
      "2️⃣ ⏭️ *Libre más próximo*\n" +
      "3️⃣ 📅 *Agenda completa*\n\n" +
      "Respondé con el número o la opción 👇",
    1500,
  );
  return { status: "success", matched: "[turno menú agenda]" };
}

/** Agenda hoy: muestra los horarios libres de hoy en texto numerado. */
async function handleAgendaHoy(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const today = localDateStr(new Date());
  const { slots, hours } = await getAvailableSlots(ctx, today);

  if (!hours) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ *Hoy no hay horarios configurados.*\n\nRespondé 2️⃣ para ver el próximo día o 3️⃣ para la agenda completa.",
      1500,
    );
    return { status: "success", matched: "[turno hoy sin agenda]" };
  }

  if (slots.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ *Hoy no quedan horarios libres.*\n\nRespondé 2️⃣ para ver el próximo día o 3️⃣ para la agenda completa.",
      1500,
    );
    return { status: "success", matched: "[turno hoy sin slots]" };
  }

  const dateStr = formatDateStr(today);
  const list = slots.map((t, i) => `   ${i + 1}.  🕐  ${t} hs`).join("\n");
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `🕐 *Horarios libres HOY* — ${dateStr}\n\n` +
      `_Elegí un horario y respondé con su número:_\n\n` +
      `${list}\n\n` +
      `0️⃣  🔙 Volver atrás`,
    1500,
  );
  rememberDate(ctx, today);
  return { status: "success", matched: "[turno hoy]" };
}

/** Agenda más próximo: busca el siguiente día hábil con horarios libres. */
async function handleAgendaProximo(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;

  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = localDateStr(d);
    const { slots } = await getAvailableSlots(ctx, dateStr);
    if (slots.length > 0) {
      const dateStr2 = formatDateStr(dateStr);
      const list = slots.map((t, idx) => `   ${idx + 1}.  🕐  ${t} hs`).join("\n");
      await sendTextMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        `⏭️ *Próximo día con horarios libres* — ${dateStr2}\n\n` +
          `_Elegí un horario y respondé con su número:_\n\n` +
          `${list}\n\n` +
          `0️⃣  🔙 Volver atrás`,
        1500,
      );
      rememberDate(ctx, dateStr);
      return { status: "success", matched: "[turno próximo]" };
    }
  }

  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "❌ No encontré disponibilidad en los próximos 14 días. Escribí más tarde.",
    1500,
  );
  return { status: "success", matched: "[turno sin disponibilidad]" };
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
    .select("business_name, email")
    .eq("id", inst.admin_id)
    .single();

  const businessName = owner?.business_name?.trim() || "";
  if (!owner || (!businessName && !owner.email)) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  // Public link uses the business name (slug) so it's friendly and stable;
  // fall back to the email slug if no business name is set.
  const identifier = businessName ? slugify(businessName) : slugify(owner.email!);
  const link = `${baseUrl}/agendar?business=${encodeURIComponent(identifier)}`;
  console.log("[agenda] link generado", { link, appUrl: baseUrl, identifier });
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
 * Handle a numeric reply ("1", "2", ...) that refers to a slot previously
 * shown via the text menu. Uses the date remembered by handleAgendaHoy /
 * handleAgendaProximo.
 */
export async function handleNumericSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, pushName, effectiveText } = ctx;

  const clean = effectiveText.trim();
  if (!/^\d{1,2}$/.test(clean)) return null;
  const index = parseInt(clean, 10);

  // "0" → volver al menú de agenda (consume el estado de la fecha)
  if (index === 0) {
    const date = getPendingDate(ctx);
    if (date) {
      await sendTextMessage(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber,
        "🔙 Volviste al menú de agenda.\n\n1️⃣ 🕐 Libre hoy\n2️⃣ ⏭️ Libre más próximo\n3️⃣ 📅 Agenda completa\n\nRespondé con el número o la opción 👇",
        1500,
      );
      return { status: "success", matched: "[turno volver]" };
    }
    return null;
  }

  if (index < 1 || index > 30) return null;

  // Peek (no consume): un intento inválido no rompe el flujo del usuario.
  const date = peekPendingDate(ctx);
  if (!date) return null;

  const { slots } = await getAvailableSlots(ctx, date);
  const chosen = slots[index - 1];
  if (!chosen) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ Ese número no corresponde a un horario. Escribí 'turno' para empezar de nuevo.",
      1500,
    );
    return { status: "success", matched: "[turno num inválido]" };
  }

  // Check conflict
  const { data: conflict } = await supabase
    .from("appointments")
    .select("id")
    .eq("instance_id", instance.id)
    .eq("appointment_date", date)
    .eq("appointment_time", chosen)
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

  const { data: newAppt } = await supabase
    .from("appointments")
    .insert({
      instance_id: instance.id,
      customer_phone: remoteJid,
      customer_name: pushName || null,
      appointment_date: date,
      appointment_time: chosen,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (newAppt) {
    // Turno agendado → el flujo de agenda TERMINA. Los números posteriores
    // ya no deben re-disparar el menú; se vuelve a empezar con la palabra clave.
    getPendingDate(ctx);
    clearAgendaActive(ctx);
    const dateStr = formatDateStr(date);
    const [h, m] = chosen.split(":");
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

  const bookingKeywords = ["turno", "agendar", "reservar", "cita", "appointment", "agenda"];
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
