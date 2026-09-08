import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST: Confirm plan selection (starter = free, pro triggers MP preference or manual confirmation)
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerClient();
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { planType } = (body ?? {}) as { planType?: string };

  if (!planType || !["starter", "pro"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "planType must be starter or pro" }, { status: 400 });
  }

  // Check current subscription status
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_type, status, max_instances")
    .eq("user_id", user.id)
    .single();

  if (!sub || sub.status === "pending") {
    // If starter, activate immediately
    if (planType === "starter") {
      await supabase.from("subscriptions").upsert({
        user_id: user.id,
        plan_type: "starter",
        status: "active",
        max_instances: 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Assign instance if missing
      const { data: assignments } = await supabase
        .from("user_instances")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (!assignments || assignments.length === 0) {
        await supabase.rpc("assign_instance_for_user", { p_user_id: user.id });
      }

      return NextResponse.json({ status: "success", data: { plan: "starter", activated: true } });
    }

    // If pro, return preference info (client should call preference endpoint or redirect to MP)
    return NextResponse.json({ status: "success", data: { plan: "pro", requires_payment: true, preference_url: "/api/payments/preference" } });
  }

  // If already active but wants to change
  await supabase.from("subscriptions").upsert({
    user_id: user.id,
    plan_type: planType,
    status: "active",
    max_instances: 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return NextResponse.json({ status: "success", data: { plan: planType, activated: true } });
}
