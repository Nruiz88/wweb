import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

// POST: Public booking (used by the /agendar link). No auth required.
// Validates the instance belongs to the user, checks availability,
// and creates a pending appointment.
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "public-book", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { business, userEmail, instanceId, customerName, customerPhone, appointmentDate, appointmentTime } = (body ?? {}) as {
    business?: string;
    userEmail?: string;
    instanceId?: string;
    customerName?: string;
    customerPhone?: string;
    appointmentDate?: string;
    appointmentTime?: string;
  };

  if ((!business && !userEmail) || !instanceId || !appointmentDate || !appointmentTime) {
    return NextResponse.json(
      { status: "error", error: "business (or userEmail), instanceId, appointmentDate, and appointmentTime are required" },
      { status: 400 },
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !/^\d{2}:\d{2}$/.test(appointmentTime)) {
    return NextResponse.json({ status: "error", error: "Invalid date or time format" }, { status: 400 });
  }

  // Resolve profile by email or by business_name/email slug.
  let profile: { id: string; role: string } | null = null;

  if (userEmail) {
    const [{ rows }] = await query<{ id: string; role: string }>(
      "SELECT id, role FROM profiles WHERE email = ? LIMIT 1",
      [userEmail.trim().toLowerCase()]
    );
    profile = rows?.[0] ?? null;
  }

  if (!profile && business) {
    const slug = business.trim().toLowerCase();
    const all = await query<{ id: string; role: string; business_name: string | null; email: string | null }>(
      "SELECT id, role, business_name, email FROM profiles"
    );
    profile =
      (all || []).find((p) => {
        if (p.business_name && slugify(p.business_name) === slug) return true;
        if (p.email && slugify(p.email) === slug) return true;
        return false;
      }) ?? null;
  }

  if (!profile) {
    return NextResponse.json({ status: "error", error: "User not found" }, { status: 404 });
  }

  let owns = false;
  if (profile.role === "admin") {
    const inst = await query<{ id: string }>(
      "SELECT id FROM instances WHERE id = ? AND admin_id = ?",
      [instanceId, profile.id]
    );
    owns = inst.length > 0;
  } else {
    const assigned = await query<{ id: string }>(
      "SELECT id FROM user_instances WHERE instance_id = ? AND user_id = ?",
      [instanceId, profile.id]
    );
    owns = assigned.length > 0;
  }

  if (!owns) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Validate the day has active business hours.
  const dateObj = new Date(appointmentDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const hours = await query<{ id: string }>(
    "SELECT id FROM business_hours WHERE instance_id = ? AND day_of_week = ? AND is_active = true",
    [instanceId, dayOfWeek]
  );

  if (hours.length === 0) {
    return NextResponse.json({ status: "error", error: "No hay horarios configurados para ese día" }, { status: 400 });
  }

  // Check conflict (pending or confirmed).
  const conflict = await query<{ id: string }>(
    "SELECT id FROM appointments WHERE instance_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed') LIMIT 1",
    [instanceId, appointmentDate, appointmentTime]
  );

  if (conflict.length > 0) {
    return NextResponse.json(
      { status: "error", error: "Ese horario ya fue tomado. Elegí otro." },
      { status: 409 },
    );
  }

  const { insertId } = await query(
    "INSERT INTO appointments (id, instance_id, customer_name, customer_phone, appointment_date, appointment_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())",
    [
      String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)),
      instanceId,
      customerName || null,
      customerPhone ? String(customerPhone).trim().replace(/\D/g, "") || null : null,
      appointmentDate,
      appointmentTime,
    ]
  );

  return NextResponse.json({
    status: "success",
    data: { id: insertId, appointment_date: appointmentDate, appointment_time: appointmentTime },
  });
}
