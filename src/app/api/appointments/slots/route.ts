import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Generate time slots between start and end given a duration */
function generateSlots(startTime: string, endTime: string, durationMin: number): { time: string; display: string }[] {
  const slots: { time: string; display: string }[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  for (let m = startMin; m + durationMin <= endMin; m += durationMin) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    const display = `${h}:${String(min).padStart(2, "0")}`;
    slots.push({ time, display });
  }

  return slots;
}

// GET: Available slots for a date
// ?instanceId=xxx&date=2026-09-01
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const date = searchParams.get("date");

  if (!instanceId || !date) {
    return NextResponse.json(
      { status: "error", error: "instanceId and date are required" },
      { status: 400 },
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ status: "error", error: "Invalid date format (use YYYY-MM-DD)" }, { status: 400 });
  }

  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay(); // 0=Sun

  const supabase = await createServerClient();

  // Get business hours for this day
  const { data: hours } = await supabase
    .from("business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("instance_id", instanceId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) {
    return NextResponse.json({
      status: "success",
      data: { date, dayOfWeek, slots: [], message: "Sin horario configurado para este día" },
    });
  }

  // Generate all possible slots
  const allSlots = generateSlots(hours.start_time, hours.end_time, hours.slot_duration_min);

  // Get existing appointments for this date
  const { data: booked } = await supabase
    .from("appointments")
    .select("appointment_time, duration_min")
    .eq("instance_id", instanceId)
    .eq("appointment_date", date)
    .in("status", ["pending", "confirmed"]);

  // Filter out booked slots
  const bookedTimes = new Set<string>();
  for (const appt of booked || []) {
    bookedTimes.add(appt.appointment_time);
  }

  // Also filter out past slots if the date is today
  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const availableSlots = allSlots.filter((slot) => {
    if (bookedTimes.has(slot.time)) return false;
    if (isToday) {
      const [h, m] = slot.time.split(":").map(Number);
      if (h * 60 + m <= currentMinutes) return false;
    }
    return true;
  });

  return NextResponse.json({
    status: "success",
    data: {
      date,
      dayOfWeek,
      startTime: hours.start_time,
      endTime: hours.end_time,
      slotDurationMin: hours.slot_duration_min,
      totalSlots: allSlots.length,
      bookedSlots: bookedTimes.size,
      slots: availableSlots,
    },
  });
}
