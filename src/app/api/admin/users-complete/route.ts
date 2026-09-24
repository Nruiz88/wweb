import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const [{ rows: users }] = await query<{ id: string; email: string; full_name: string; role: string; created_at: string }>(
    "SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 50"
  );

  const [{ rows: subs }] = await query<{ user_id: string; plan_type: string; status: string; max_instances: number; paid_until: string | null; purchased_at: string | null }>(
    "SELECT user_id, plan_type, status, max_instances, paid_until, purchased_at FROM subscriptions"
  );
  const [{ rows: payments }] = await query<{ user_id: string; status: string; amount_cents: number; created_at: string }>(
    "SELECT user_id, status, amount_cents, created_at FROM payments ORDER BY created_at DESC"
  );
  const [{ rows: assignments }] = await query<{ user_id: string; instance_id: string }>(
    "SELECT user_id, instance_id FROM user_instances"
  );

  const subByUser = new Map(subs.map((s) => [s.user_id, s]));
  const payLatest = {};
  for (const p of payments) {
    if (!payLatest[p.user_id] || new Date(p.created_at) > new Date(payLatest[p.user_id].created_at)) {
      payLatest[p.user_id] = p;
    }
  }
  const assignedSet = new Set(assignments.map((a) => a.user_id));

  const data = (users || []).map((u) => {
    const s = subByUser.get(u.id);
    const p = payLatest[u.id];
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      created_at: u.created_at,
      plan: s?.plan_type || "pending",
      status: s?.status || "pending",
      max_instances: s?.max_instances || 0,
      paid_until: s?.paid_until || null,
      purchased_at: s?.purchased_at || null,
      latest_payment_amount: p?.amount_cents || 0,
      latest_payment_status: p?.status || "pending",
      assigned: assignedSet.has(u.id),
    };
  });

  return NextResponse.json({ status: "success", data });
}
