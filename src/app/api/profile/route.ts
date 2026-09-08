import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/api-helpers";
import { sanitizeString } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET: Get current user's profile
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  // lite=1: solo el plan (1 query). Para el layout/nav que solo muestra el badge.
  const searchParams = new URL(request.url).searchParams;
  const lite = searchParams.get("lite") === "1";
  const includeUpcoming = searchParams.get("include") === "upcoming";
  if (lite) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_type, status")
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({
      status: "success",
      data: {
        subscription: sub
          ? { plan_type: sub.plan_type, status: sub.status }
          : { plan_type: "starter", status: "active" },
      },
    });
  }

  const [profileRes, subRes, usedRes, addonRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, business_name, phone, address, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("subscriptions")
      .select("plan_type, status, max_instances, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_instances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("instance_addons")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  if (profileRes.error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(profileRes.error) }, { status: 500 });
  }

  const sub = subRes.data;
  const usedInstances = usedRes.count ?? 0;
  const addonCount = addonRes.count ?? 0;

  // include=upcoming: agrega los próximos turnos en el servidor (1 roundtrip
  // en vez del N+1 que hacía el cliente: 1x instances + Nx appointments).
  let upcoming: Array<{ date: string; time: string; name: string | null }> = [];
  if (includeUpcoming) {
    const [ownRes, assignRes] = await Promise.all([
      supabase.from("instances").select("id").eq("admin_id", user.id),
      supabase.from("user_instances").select("instance_id").eq("user_id", user.id),
    ]);
    const ids = [
      ...((ownRes.data ?? []) as Array<{ id: string }>).map((i) => i.id),
      ...((assignRes.data ?? []) as Array<{ instance_id: string }>).map((a) => a.instance_id),
    ];
    if (ids.length > 0) {
      const now = new Date();
      const from = now.toISOString().slice(0, 10);
      const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: appts } = await supabase
        .from("appointments")
        .select("status, appointment_date, appointment_time, customer_name, customer_phone")
        .in("instance_id", ids)
        .gte("appointment_date", from)
        .lte("appointment_date", to)
        .in("status", ["pending", "confirmed"])
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(25);
      upcoming = ((appts ?? []) as Array<{
        status: string; appointment_date: string; appointment_time: string;
        customer_name: string | null; customer_phone: string | null;
      }>)
        .map((a) => ({ date: a.appointment_date, time: a.appointment_time, name: a.customer_name || a.customer_phone }))
        .slice(0, 5);
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      ...profileRes.data,
      subscription: sub ? {
        plan_type: sub.plan_type,
        status: sub.status,
        max_instances: sub.max_instances,
        used_instances: usedInstances,
        addons: addonCount,
        updated_at: sub.updated_at,
      } : {
        plan_type: "starter",
        status: "active",
        max_instances: 1,
        used_instances: usedInstances,
        addons: 0,
        updated_at: null,
      },
      ...(includeUpcoming ? { upcoming } : {}),
    },
  });
}

// PUT: Update current user's profile
export async function PUT(request: Request) {
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

  const { full_name, business_name, phone, address } = (body ?? {}) as {
    full_name?: string;
    business_name?: string;
    phone?: string;
    address?: string;
  };

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      full_name: sanitizeString(full_name, 200),
      business_name: sanitizeString(business_name, 200),
      phone: sanitizeString(phone, 20),
      address: sanitizeString(address, 500),
    })
    .eq("id", user.id)
    .select("id, email, full_name, role, business_name, phone, address, created_at")
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: profile });
}
