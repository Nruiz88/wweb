import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

// GET: Plan distribution + per-user details
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const [{ rows: profiles }] = await query<{ id: string; email: string; full_name: string; role: string; created_at: string }>(
    "SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC"
  );
  const [{ rows: subs }] = await query<{ user_id: string; plan_type: string; status: string; max_instances: number }>(
    "SELECT user_id, plan_type, status, max_instances FROM subscriptions"
  );
  const [{ rows: addons }] = await query<{ user_id: string; quantity: number; status: string }>(
    "SELECT user_id, quantity, status FROM instance_addons"
  );
  const [{ rows: assignments }] = await query<{ user_id: string }>(
    "SELECT user_id FROM user_instances"
  );

  const subByUser = new Map(subs.map((s) => [s.user_id, s]));
  const addonsByUser = new Map();
  for (const a of addons) {
    if (a.status !== "active") continue;
    addonsByUser.set(a.user_id, (addonsByUser.get(a.user_id) || 0) + (a.quantity || 0));
  }
  const countByUser = new Map();
  for (const a of assignments) {
    countByUser.set(a.user_id, (countByUser.get(a.user_id) || 0) + 1);
  }

  const planDistribution = { starter: 0, pro: 0 };
  let activeSubscriptions = 0;
  let totalAddons = 0;

  const usersWithPlans = (profiles || []).map((p) => {
    const sub = subByUser.get(p.id);
    const base = sub?.max_instances ?? 1;
    const userAddons = addonsByUser.get(p.id) ?? 0;
    const effectiveMax = base + userAddons;
    const used = countByUser.get(p.id) ?? 0;

    if (sub) {
      const plan = sub.plan_type;
      if (plan in planDistribution) planDistribution[plan] += 1;
      if (sub.status === "active") activeSubscriptions += 1;
    } else {
      planDistribution.starter += 1;
    }
    totalAddons += userAddons;

    return {
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      created_at: p.created_at,
      plan: (sub?.plan_type) ?? "starter",
      status: sub?.status ?? "active",
      max_instances: effectiveMax,
      addons: userAddons,
      used_instances: used,
    };
  });

  return NextResponse.json({
    status: "success",
    data: {
      plan_distribution: planDistribution,
      active_subscriptions: activeSubscriptions,
      total_addons: totalAddons,
      users: usersWithPlans,
    },
  });
}
