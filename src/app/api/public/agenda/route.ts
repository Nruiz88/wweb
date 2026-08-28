import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Generate HH:MM slots between start and end given a duration. */
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
    slots.push({ time, display: `${h}:${String(min).padStart(2, "0")}` });
  }
  return slots;
}

// GET: Public availability for a user's agenda (all their instances).
// ?user=<email>  →  { instances: [{ instanceId, instanceName, days: [...] }] }
export async function GET(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "public-agenda", { maxRequests: 60, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get("user")?.trim().toLowerCase();

  if (!userEmail) {
    return NextResponse.json({ status: "error", error: "user is required" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", userEmail)
    .single();

  if (!profile) {
    return NextResponse.json({ status: "error", error: "User not found" }, { status: 404 });
  }

  // Resolve the user's instances: admin → own, user → assigned
  let instanceIds: string[] = [];
  if (profile.role === "admin") {
    const { data: own } = await supabase
      .from("instances")
      .select("id")
      .eq("admin_id", profile.id);
    instanceIds = (own || []).map((i) => i.id);
  } else {
    const { data: assigned } = await supabase
      .from("user_instances")
      .select("instance_id")
      .eq("user_id", profile.id);
    instanceIds = (assigned || []).map((a) => a.instance_id);
  }

  if (instanceIds.length === 0) {
    return NextResponse.json({ status: "success", data: { instances: [] } });
  }

  const { data: instances } = await supabase
    .from("instances")
    .select("id, instance_name, status")
    .in("id", instanceIds);

  const { data: hoursAll } = await supabase
    .from("business_hours")
    .select("instance_id, day_of_week, start_time, end_time, slot_duration_min")
    .in("instance_id", instanceIds)
    .eq("is_active", true);

  const { data: bookedAll } = await supabase
    .from("appointments")
    .select("instance_id, appointment_date, appointment_time")
    .in("instance_id", instanceIds)
    .in("status", ["pending", "confirmed"]);

  const hoursByInstance = new Map<string, Map<number, { start_time: string; end_time: string; slot_duration_min: number }>>();
  for (const h of hoursAll || []) {
    if (!hoursByInstance.has(h.instance_id)) hoursByInstance.set(h.instance_id, new Map());
    hoursByInstance.get(h.instance_id)!.set(h.day_of_week, h);
  }

  const bookedByInstance = new Map<string, Set<string>>();
  for (const b of bookedAll || []) {
    if (!bookedByInstance.has(b.instance_id)) bookedByInstance.set(b.instance_id, new Set());
    bookedByInstance.get(b.instance_id)!.add(`${b.appointment_date}|${b.appointment_time}`);
  }

  const now = new Date();
  const days: { date: string; display: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, display: dateStr });
  }

  const result = (instances || []).map((inst) => {
    const hours = hoursByInstance.get(inst.id) || new Map();
    const booked = bookedByInstance.get(inst.id) || new Set();

    const dayList = days.map((d) => {
      const dateObj = new Date(d.date + "T12:00:00");
      const dayHours = hours.get(dateObj.getDay());
      if (!dayHours) return { date: d.date, slots: [] };

      const all = generateSlots(dayHours.start_time, dayHours.end_time, dayHours.slot_duration_min);
      const isToday = d.date === now.toISOString().slice(0, 10);
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const slots = all.filter((s) => {
        if (booked.has(`${d.date}|${s.time}`)) return false;
        if (isToday) {
          const [h, m] = s.time.split(":").map(Number);
          if (h * 60 + m <= nowMinutes) return false;
        }
        return true;
      });

      return { date: d.date, slots };
    });

    return {
      instanceId: inst.id,
      instanceName: inst.instance_name,
      status: inst.status,
      days: dayList.filter((d) => d.slots.length > 0),
    };
  }).filter((inst) => inst.days.length > 0);

  return NextResponse.json({ status: "success", data: { instances: result } });
}