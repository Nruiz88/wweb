import { query } from "../db";
import type { WebhookContext } from "./context";
import { sendTextMessage, sendButtonMessage } from "../evolution-multi";
import { generateSlots } from "./booking-utils";

async function sendText(ctx: WebhookContext, text: string, delay?: number) {
  return sendTextMessage(ctx.instance.evolution_api_url, ctx.instance.evolution_api_key, ctx.instance.instance_name, ctx.phoneNumber, text, delay);
}

/** Handle numeric reply to a text menu (e.g. "2" for a slot previously shown) */
export async function handleNumericSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, pushName, effectiveText } = ctx;
  const clean = effectiveText.trim();
  if (!/^\d{1,2}$/.test(clean)) return null;
  const index = parseInt(clean, 10);
  if (index === 0) {
    const { rows: pending } = await query<{ date: string }>("SELECT date FROM pending WHERE instance_id = ? AND phone = ? LIMIT 1", [instance.id, remoteJid]);
    if (pending.length > 0) {
      await sendText(ctx, "🔙 Volviste al menú de agenda.\n\n1️⃣ 🕐 Libre hoy\n2️⃣ ⏭️ Libre más próximo\n3️⃣ 📅 Agenda completa\n\nRespondé con el número o la opción 👇", 1500);
      return { status: "success", matched: "turno volver" };
    }
    return null;
  }
  if (index < 1 || index > 30) return null;
  const [{ rows: pending }] = await query<{ date: string }>("SELECT date FROM pending WHERE instance_id = ? AND phone = ? LIMIT 1", [instance.id, remoteJid]);
  const date = pending?.[0]?.date;
  if (!date) return null;
  const [{ rows: hours }] = await query<{ start_time: string; end_time: string; slot_duration_min: number }>(
    "SELECT start_time, end_time, slot_duration_min FROM business_hours WHERE instance_id = ? AND is_active = true LIMIT 1",
    [instance.id]
  );
  if (!hours?.length) return null;
  const all = generateSlots(hours[0].start_time, hours[0].end_time, hours[0].slot_duration_min);
  const chosen = all[index - 1];
  if (!chosen) {
    await sendText(ctx, "❌ Ese número no corresponde a un horario. Escribí 'turno' para empezar de nuevo.", 1500);
    return { status: "success", matched: "turno num inválido" };
  }
  const [{ rows: conflict }] = await query<{ id: string }>(
    "SELECT id FROM appointments WHERE instance_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed') LIMIT 1",
    [instance.id, date, chosen]
  );
  if (conflict.length > 0) {
    await sendText(ctx, '❌ Ese horario ya fue tomado. Escribí "turno" para ver otros disponibles.', 1500);
    return { status: "success", matched: "turno ocupado" };
  }
  const [{ insertId }] = await query(
    "INSERT INTO appointments (id, instance_id, customer_phone, customer_name, appointment_date, appointment_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', NOW(), NOW())",
    [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), instance.id, remoteJid, pushName || null, date, chosen]
  );
  if (insertId) {
    const { rows: pending } = await query("DELETE FROM pending WHERE instance_id = ? AND phone = ?", [instance.id, remoteJid]);
    const dateStr = formatDateStr(date);
    const [h, m] = chosen.split(":");
    await sendText(ctx, `✅ ¡Turno agendado!\n\n📅 ${dateStr} a las ${h}:${m}\n\nTe enviaremos un recordatorio 24 horas antes. ¡Nos vemos!`, 1500);
  }
  return { status: "success", matched: "turno agendado" };
}
