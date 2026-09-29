import { NextResponse } from "next/server";
import { query, generateId } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";
import { todayInBusinessTimezone, timeInBusinessTimezone } from "@/lib/timezone";
import { requireProFeature, planForbiddenResponse } from "@/lib/plan-gating";

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
    const rows = await query<{ id: string; role: string }>(
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

  // Instancia válida = propia (instances.admin_id) UNION asignada. La
  // bifurcación por `role === "admin"` dejaba afuera al owner con role="user",
  // que sí veía su instancia en /calendar pero no podía recibir reservas por
  // el link público.
  const owns = await query<{ id: string }>(
    `SELECT id FROM instances
     WHERE id = ?
       AND (admin_id = ? OR id IN (SELECT instance_id FROM user_instances WHERE user_id = ?))
     LIMIT 1`,
    [instanceId, profile.id, profile.id]
  );

  if (owns.length === 0) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Gating por plan: reservar por link público es feature Pro (owner siempre pasa).
  const planInfo = await requireProFeature(profile.id, instanceId, "appointments");
  if (!planInfo) {
    const forbidden = planForbiddenResponse("appointments");
    return NextResponse.json(forbidden.body, { status: forbidden.status });
  }

  // Validate the day has active business hours.
  const dateObj = new Date(appointmentDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const hours = await query<{
    id: string; start_time: string; end_time: string; slot_duration_min: number;
  }>(
    "SELECT id, start_time, end_time, slot_duration_min FROM business_hours WHERE instance_id = ? AND day_of_week = ? AND is_active = true",
    [instanceId, dayOfWeek]
  );

  if (hours.length === 0) {
    return NextResponse.json({ status: "error", error: "No hay horarios configurados para ese día" }, { status: 400 });
  }

  // La hora debe caer dentro del rango y respectar la duración del turno.
  // Antes solo se validaba que el día tuviera horario: un POST directo podía
  // inventar horarios fuera de rango y meterlos en el calendario.
  const dayHours = hours[0];
  const [tH, tM] = appointmentTime.split(":").map(Number);
  const [sH, sM] = dayHours.start_time.split(":").map(Number);
  const [eH, eM] = dayHours.end_time.split(":").map(Number);
  const requested = tH * 60 + tM;
  const startMin = sH * 60 + sM;
  const endMin = eH * 60 + eM;
  const duration = dayHours.slot_duration_min || 30;

  if (requested < startMin || requested + duration > endMin) {
    return NextResponse.json(
      { status: "error", error: `Ese horario está fuera del horario de atención (${dayHours.start_time} - ${dayHours.end_time})` },
      { status: 400 },
    );
  }
  if (requested % duration !== startMin % duration) {
    return NextResponse.json({ status: "error", error: "Ese horario no coincide con la duración del turno" }, { status: 400 });
  }

  // No se puede agendar en el pasado.
  const today = todayInBusinessTimezone();
  const nowTime = timeInBusinessTimezone();
  if (appointmentDate < today || (appointmentDate === today && appointmentTime <= nowTime)) {
    return NextResponse.json({ status: "error", error: "Ese horario ya pasó. Elegí otro." }, { status: 400 });
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

  // user_id antes quedaba NULL en los bookings del link público.
  const appointmentId = generateId();

  await query(
    "INSERT INTO appointments (id, instance_id, user_id, customer_name, customer_phone, appointment_date, appointment_time, duration_min, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())",
    [
      appointmentId,
      instanceId,
      profile.id,
      customerName || null,
      customerPhone ? String(customerPhone).trim().replace(/\D/g, "") || null : null,
      appointmentDate,
      appointmentTime,
      duration,
    ]
  );

  return NextResponse.json({
    status: "success",
    data: { id: appointmentId, appointment_date: appointmentDate, appointment_time: appointmentTime },
  });
}
