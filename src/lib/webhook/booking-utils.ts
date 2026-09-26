import { query } from "../db";
import { DAYS, MONTHS, localTimeMinutes } from "../db/types";
import type { WebhookContext } from "./context";
import { sendTextMessage, sendButtonMessage } from "../evolution-multi";

/** Generate HH:MM slots between start and end given a duration. */
export function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
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
export async function getAvailableSlots(
  ctx: WebhookContext,
  date: string,
): Promise<{ slots: string[]; hours: { start_time: string; end_time: string; slot_duration_min: number } | null }> {
  const { instance } = ctx;
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const hours = await query<{ start_time: string; end_time: string; slot_duration_min: number }>(
    "SELECT start_time, end_time, slot_duration_min FROM business_hours WHERE instance_id = ? AND day_of_week = ? AND is_active = true LIMIT 1",
    [instance.id, dayOfWeek]
  );

  if (!hours?.length) return { slots: [], hours: null };

  const all = generateSlots(hours[0].start_time, hours[0].end_time, hours[0].slot_duration_min);

  const booked = await query<{ appointment_time: string }>(
    "SELECT appointment_time FROM appointments WHERE instance_id = ? AND appointment_date = ? AND status IN ('pending','confirmed')",
    [instance.id, date]
  );

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

  return { slots, hours: hours[0] };
}

function localDateStr(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const date = d.getDate();
  const month = d.getMonth();
  return `${DAYS[day]} ${date} ${MONTHS[month]}`;
}
