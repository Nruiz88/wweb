import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

// POST: Public booking (used by the /agendar link). No auth required.
// Validates the instance belongs to the user, checks availability,
// and creates a pending appointment.
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "public-book", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const supabase = await createServerClient();

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

  // Verify the user owns / has access to this instance
  let profile: { id: string; role: string } | null = null;

  if (userEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("email", userEmail.trim().toLowerCase())
      .single();
    profile = data ?? null;
  }

  if (!profile && business) {
    const slug = business.trim().toLowerCase();
    const { data: all } = await supabase
      .from("profiles")
      .select("id, role, business_name, email");
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
    const { data: inst } = await supabase
      .from("instances")
      .select("id")
      .eq("id", instanceId)
      .eq("admin_id", profile.id)
      .single();
    owns = !!inst;
  } else {
    const { data: assigned } = await supabase
      .from("user_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("user_id", profile.id)
      .single();
    owns = !!assigned;
  }

  if (!owns) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Validate the day has active business hours
  const dateObj = new Date(appointmentDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const { data: hours } = await supabase
    .from("business_hours")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) {
    return NextResponse.json({ status: "error", error: "No hay horarios configurados para ese día" }, { status: 400 });
  }

  // Check conflict (pending or confirmed)
  const { data: conflict } = await supabase
    .from("appointments")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("appointment_date", appointmentDate)
    .eq("appointment_time", appointmentTime)
    .in("status", ["pending", "confirmed"])
    .limit(1);

  if (conflict && conflict.length > 0) {
    return NextResponse.json(
      { status: "error", error: "Ese horario ya fue tomado. Elegí otro." },
      { status: 409 },
    );
  }

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      instance_id: instanceId,
      customer_name: customerName || null,
      customer_phone: customerPhone ? String(customerPhone).trim().replace(/\D/g, "") || null : null,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: "pending",
    })
    .select("id, appointment_date, appointment_time")
    .single();

  if (error) {
    console.error("[public-book] insert failed:", error.message);
    return NextResponse.json({ status: "error", error: "No se pudo guardar el turno" }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: appointment });
}