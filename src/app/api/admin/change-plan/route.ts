import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PATCH: Change a user's plan (admin only)
export async function PATCH(request: Request) {
  const rlResponse = await rateLimitResponse(request, "admin/change-plan", { maxRequests: 30 });
  if (rlResponse) return rlResponse;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  // Verify admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, planType } = (body ?? {}) as {
    userId?: string;
    planType?: string;
  };

  if (!userId || !planType) {
    return NextResponse.json({ status: "error", error: "userId and planType required" }, { status: 400 });
  }

  if (!["starter", "pro", "community"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "Invalid plan type" }, { status: 400 });
  }

  // Update subscription
  const { error } = await supabase
    .from("subscriptions")
    .update({ plan_type: planType })
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: { userId, planType } });
}
