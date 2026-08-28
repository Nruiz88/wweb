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
  const lite = new URL(request.url).searchParams.get("lite") === "1";
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
