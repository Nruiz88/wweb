import { query } from "../db";
import type { WebhookContext } from "./context";
import { sendTextMessage, sendButtonMessage } from "../evolution-multi";
import { slugify } from "../slug";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

async function sendText(ctx: WebhookContext, text: string, delay?: number) {
  return sendTextMessage(ctx.instance.evolution_api_url, ctx.instance.evolution_api_key, ctx.instance.instance_name, ctx.phoneNumber, text, delay);
}

async function sendButton(ctx: WebhookContext, title: string, description: string, buttons: { type: string; displayText: string; id: string }[], delay?: number) {
  return sendButtonMessage(ctx.instance.evolution_api_url, ctx.instance.evolution_api_key, ctx.instance.instance_name, ctx.phoneNumber, title, description, buttons, undefined, delay);
}

/** Handle time slot selection */
export async function handleSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, pushName, effectiveText } = ctx;
  if (!effectiveText.startsWith("slot_")) return null;
  const parts = effectiveText.replace("slot_", "");
  const lastUnderscore = parts.lastIndexOf("_");
  const slotDate = parts.slice(0, lastUnderscore);
  const slotTime = parts.slice(lastUnderscore + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !/^\d{2}:\d{2}$/.test(slotTime)) return null;
  const [{ rows: conflict }] = await query<{ id: string }>(
    "SELECT id FROM appointments WHERE instance_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed') LIMIT 1",
    [instance.id, slotDate, slotTime]
  );
  if (conflict.length > 0) {
    await sendText(ctx, '❌ Ese horario ya fue tomado. Escribí "turno" para ver otros disponibles.', 1500);
    return { status: "success", matched: "turno ocupado" };
  }
  const [{ insertId }] = await query(
    "INSERT INTO appointments (id, instance_id, customer_phone, customer_name, appointment_date, appointment_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', NOW(), NOW())",
    [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), instance.id, remoteJid, pushName || null, slotDate, slotTime]
  );
  if (insertId) {
    const dateStr = formatDateStr(slotDate);
    const [h, m] = slotTime.split(":");
    await sendText(ctx, `✅ ¡Turno agendado!\n\n📅 ${dateStr} a las ${h}:${m}\n\nTe enviaremos un recordatorio 24 horas antes. ¡Nos vemos!`, 1500);
  }
  return { status: "success", matched: "turno agendado" };
}

/** Handle date selection */
export async function handleDateSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;
  if (!effectiveText.startsWith("date_")) return null;
  const slotDate = effectiveText.replace("date_", "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) return null;
  const dateObj = new Date(slotDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();
  const [{ rows: hours }] = await query<{ start_time: string; end_time: string; slot_duration_min: number }>(
    "SELECT start_time, end_time, slot_duration_min FROM business_hours WHERE instance_id = ? AND day_of_week = ? AND is_active = true LIMIT 1",
    [instance.id, dayOfWeek]
  );
  if (!hours?.length) {
    await sendText(ctx, "❌ No hay horarios disponibles para ese día.", 1500);
    return { status: "success", matched: "turno sin horarios" };
  }
  const [sh, sm] = hours[0].start_time.split(":").map(Number);
  const [eh, em] = hours[0].end_time.split(":").map(Number);
  const dur = hours[0].slot_duration_min;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const [{ rows: booked }] = await query<{ appointment_time: string }>(
    "SELECT appointment_time FROM appointments WHERE instance_id = ? AND appointment_date = ? AND status IN ('pending','confirmed')",
    [instance.id, slotDate]
  );
  const bookedSet = new Set((booked || []).map((b) => b.appointment_time));
  const now = new Date();
  const todayStr = localDateStr(now);
  const isToday = slotDate === todayStr;
  const nowMinutes = localTimeMinutes(now);
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
    await sendText(ctx, '❌ No hay horarios disponibles para ese día. Escribí "turno" para ver otros días.', 1500);
    return { status: "success", matched: "turno sin slots" };
  }
  const dateStr = formatDateStr(slotDate);
  const timeButtons: { type: string; displayText: string; id: string }[] = availableSlots.slice(0, 3).map((t) => ({
    type: "reply", displayText: t, id: `slot_${slotDate}_${t}`
  }));
  await sendButton(ctx, `Horarios disponibles - ${dateStr}`, "Elegí un horario:", timeButtons, 1500);
  return { status: "success", matched: "turno selección hora" };
}
