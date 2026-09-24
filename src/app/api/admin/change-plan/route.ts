import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { rateLimitResponse } from "../../../lib/rate-limit";
import { isValidUUID } from "../../../lib/validation";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const rlResponse = await rateLimitResponse(request, "admin/change-plan", { maxRequests: 30 });
  if (rlResponse) return rlResponse;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, planType } = body as { userId?: string; planType?: string };

  if (!userId || !planType) {
    return NextResponse.json({ status: "error", error: "userId and planType required" }, { status: 400 });
  }
  if (!["starter", "pro"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "Invalid plan type" }, { status: 400 });
  }
  if (!isValidUUID(userId)) {
    console.error("[change-plan] invalid userId", { userId });
    return NextResponse.json({ status: "error", error: "Invalid user ID" }, { status: 400 });
  }

  const id = String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15);
  await query(
    `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, paid_until, purchased_at, created_at, updated_at)
     VALUES (?, ?, ?, 'active', 1, NULL, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       plan_type = VALUES(plan_type),
       status = VALUES(status),
       max_instances = VALUES(max_instances),
       paid_until = VALUES(paid_until),
       purchased_at = VALUES(purchased_at),
       updated_at = NOW()`,
    [id, userId, planType]
  );

  console.log("[change-plan] ok", { userId, planType });
  return NextResponse.json({ status: "success", data: { userId, planType } });
}
