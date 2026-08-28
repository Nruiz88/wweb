import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-helpers";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

// PATCH: Change a user's plan (admin only)
export async function PATCH(request: Request) {
  const rlResponse = await rateLimitResponse(request, "admin/change-plan", { maxRequests: 30 });
  if (rlResponse) return rlResponse;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, planType } = (body ?? {}) as { userId?: string; planType?: string };

  if (!userId || !planType) {
    return NextResponse.json({ status: "error", error: "userId and planType required" }, { status: 400 });
  }

  if (!["starter", "pro", "community"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "Invalid plan type" }, { status: 400 });
  }

  if (!isValidUUID(userId)) {
    return NextResponse.json({ status: "error", error: "Invalid user ID" }, { status: 400 });
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, plan_type: planType },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: { userId, planType } });
}
