import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function verifyUserAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  instanceId: string,
) {
  const { data: adminInstance } = await supabase
    .from("instances")
    .select("id")
    .eq("id", instanceId)
    .eq("admin_id", userId)
    .single();
  if (adminInstance) return true;

  const { data: assignment } = await supabase
    .from("user_instances")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .single();
  return !!assignment;
}

// GET: List appointments (optionally filtered by date range or status)
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("from");
  const dateTo = searchParams.get("to");
  const phone = searchParams.get("phone");

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("instance_id", instanceId)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (status) query = query.eq("status", status);
  if (dateFrom) query = query.gte("appointment_date", dateFrom);
  if (dateTo) query = query.lte("appointment_date", dateTo);
  if (phone) query = query.eq("customer_phone", phone);

  const { data: appointments, error } = await query;

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: appointments });
}

// POST: Create new appointment (admin/system only — customers book via webhook)
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const {
    instanceId,
    customerPhone,
    customerName,
    appointmentDate,
    appointmentTime,
    durationMin,
    notes,
  } = (body ?? {}) as {
    instanceId?: string;
    customerPhone?: string;
    customerName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    durationMin?: number;
    notes?: string;
  };

  if (!instanceId || !customerPhone || !appointmentDate || !appointmentTime) {
    return NextResponse.json(
      { status: "error", error: "instanceId, customerPhone, appointmentDate, and appointmentTime are required" },
      { status: 400 },
    );
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Check for conflicts
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("appointment_date", appointmentDate)
    .eq("appointment_time", appointmentTime)
    .in("status", ["pending", "confirmed"])
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { status: "error", error: "Este horario ya está ocupado" },
      { status: 409 },
    );
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      instance_id: instanceId,
      user_id: user.id,
      customer_phone: customerPhone,
      customer_name: customerName || null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      duration_min: durationMin ?? 30,
      status: "pending",
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: appointment });
}

// PATCH: Update appointment status
export async function PATCH(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status, notes, reminder24hSent } = (body ?? {}) as {
    id?: string;
    status?: string;
    notes?: string;
    reminder24hSent?: boolean;
  };

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Appointment not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (status !== undefined) updatePayload.status = status;
  if (notes !== undefined) updatePayload.notes = notes;
  if (reminder24hSent !== undefined) updatePayload.reminder_24h_sent = reminder24hSent;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: appointment });
}
