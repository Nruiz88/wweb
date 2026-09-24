import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

export const dynamic = "force-dynamic";

// POST: Confirm plan selection (starter = free, pro triggers MP preference or manual confirmation)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { planType } = body as { planType?: string };

  if (!planType || !["starter", "pro"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "planType must be starter or pro" }, { status: 400 });
  }

  // Check current subscription status
  const [{ rows: subs }] = await query<{ plan_type: string; status: string; max_instances: number }>(
    "SELECT plan_type, status, max_instances FROM subscriptions WHERE user_id = ? LIMIT 1",
    [session.userId]
  );
  const sub = subs?.[0];

  if (!sub || sub.status === "pending") {
    if (planType === "starter") {
      const id = String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15);
      await query(
        `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, paid_until, purchased_at, created_at, updated_at)
         VALUES (?, ?, 'starter', 'active', 1, NULL, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           plan_type = VALUES(plan_type),
           status = VALUES(status),
           max_instances = VALUES(max_instances),
           paid_until = VALUES(paid_until),
           purchased_at = VALUES(purchased_at),
           updated_at = NOW()`,
        [id, session.userId]
      );

      // Assign instance if missing
      const [{ rows: assignments }] = await query<{ id: string }>(
        "SELECT id FROM user_instances WHERE user_id = ? LIMIT 1",
        [session.userId]
      );
      if (!assignments.length) {
        try {
          await query("CALL assign_instance_for_user(?)", [session.userId]);
        } catch (rpcErr: unknown) {
          console.error("[onboarding] assign_instance_for_user RPC failed:", rpcErr instanceof Error ? rpcErr.message : String(rpcErr));
        }
      }

      return NextResponse.json({ status: "success", data: { plan: "starter", activated: true } });
    }

    return NextResponse.json({ status: "success", data: { plan: "pro", requires_payment: true, preference_url: "/api/payments/preference" } });
  }

  // If already active but wants to change
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
    [id, session.userId, planType]
  );

  return NextResponse.json({ status: "success", data: { plan: planType, activated: true } });
}
