import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Get current user's profile
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, business_name, phone, address, created_at")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  // Fetch subscription
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_type, status, max_instances, updated_at")
    .eq("user_id", user.id)
    .single();

  // Count used instances
  const { count: usedInstances } = await supabase
    .from("user_instances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Count addons
  const { count: addonCount } = await supabase
    .from("instance_addons")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  return NextResponse.json({
    status: "success",
    data: {
      ...profile,
      subscription: sub ? {
        plan_type: sub.plan_type,
        status: sub.status,
        max_instances: sub.max_instances,
        used_instances: usedInstances ?? 0,
        addons: addonCount ?? 0,
        updated_at: sub.updated_at,
      } : {
        plan_type: "starter",
        status: "active",
        max_instances: 1,
        used_instances: usedInstances ?? 0,
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
      full_name: full_name ?? null,
      business_name: business_name ?? null,
      phone: phone ?? null,
      address: address ?? null,
    })
    .eq("id", user.id)
    .select("id, email, full_name, role, business_name, phone, address, created_at")
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: profile });
}
