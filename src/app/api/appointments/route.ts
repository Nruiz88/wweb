import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List appointments (optionally filtered by date range or status)
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const phone = searchParams.get("phone");

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  let sql = "SELECT * FROM appointments WHERE instance_id = ? ORDER BY appointment_date ASC, appointment_time ASC";
  const params: any[] = [instanceId];

  if (status && ["pending", "confirmed", "canceled", "completed"].includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    sql += " AND appointment_date >= ?";
    params.push(dateFrom);
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    sql += " AND appointment_date <= ?";
    params.push(dateTo);
  }
  if (phone) {
    sql += " AND customer_phone = ?";
    params.push(phone);
  }

  const [{ rows: appointments }] = await query<any>(sql, params);

  return NextResponse.json({ status: "success", data: appointments });
}

// POST: Create new appointment (admin/system only — customers book via webhook)
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, customerPhone, customerName, appointmentDate, appointmentTime, durationMin, notes } = body as {
    instanceId?: string; customerPhone?: string; customerName?: string;
    appointmentDate?: string; appointmentTime?: string; durationMin?: number; notes?: string;
  };

  if (!instanceId || !customerPhone || !appointmentDate || !appointmentTime) {
    return NextResponse.json(
      { status: "error", error: "instanceId, customerPhone, appointmentDate, and appointmentTime are required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const [{ rows: conflicts }] = await query<{ id: string }>(
    "SELECT id FROM appointments WHERE instance_id = ? AND appointment_date = ? AND appointment_time = ? AND status IN ('pending','confirmed') LIMIT 1",
    [instanceId, appointmentDate, appointmentTime]
  );

  if (conflicts.length > 0) {
    return NextResponse.json({ status: "error", error: "Este horario ya está ocupado" }, { status: 409 });
  }

  const id = Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
  const [{ insertId }] = await query(
    "INSERT INTO appointments (id, instance_id, user_id, customer_phone, customer_name, appointment_date, appointment_time, duration_min, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())",
    [id, instanceId, session.userId, customerPhone, customerName || null, appointmentDate, appointmentTime, durationMin ?? 30, notes || null]
  );

  return NextResponse.json({ status: "success", data: { id: insertId, appointment_date: appointmentDate, appointment_time: appointmentTime } });
}

// PATCH: Update appointment status
export async function PATCH(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { id, status, notes, reminder24hSent } = body as { id?: string; status?: string; notes?: string; reminder24hSent?: boolean };

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const [{ rows: existing }] = await query<{ id: string; instance_id: string }>(
    "SELECT id, instance_id FROM appointments WHERE id = ? LIMIT 1",
    [id]
  );

  if (!existing.length) {
    return NextResponse.json({ status: "error", error: "Appointment not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (reminder24hSent !== undefined) updates.reminder_24h_sent = reminder24hSent;

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`);
  const values = [...Object.values(updates), id];

  await query(`UPDATE appointments SET ${setClauses.join(", ")} WHERE id = ?`, values);

  return NextResponse.json({ status: "success", data: { id, ...updates } });
}

// DELETE: Remove an appointment
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const [{ rows: existing }] = await query<{ id: string; instance_id: string }>(
    "SELECT id, instance_id FROM appointments WHERE id = ? LIMIT 1",
    [id]
  );

  if (!existing.length) {
    return NextResponse.json({ status: "error", error: "Appointment not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  await query("DELETE FROM appointments WHERE id = ?", [id]);
  return NextResponse.json({ status: "success" });
}
