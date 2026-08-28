import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

// GET: Plan distribution + per-user details (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    return NextResponse.json({ status: "error", error: profilesError.message }, { status: 500 });
  }

  const [subs, addons, assignments] = await Promise.all([
    supabase.from("subscriptions").select("user_id, plan_type, status, max_instances"),
    supabase.from("instance_addons").select("user_id, quantity, status"),
    supabase.from("user_instances").select("user_id"),
  ]);

  const subByUser = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
  const addonsByUser = new Map<string, number>();
  for (const a of addons.data ?? []) {
    if (a.status !== "active") continue;
    addonsByUser.set(a.user_id, (addonsByUser.get(a.user_id) ?? 0) + (a.quantity ?? 0));
  }
  const countByUser = new Map<string, number>();
  for (const a of assignments.data ?? []) {
    countByUser.set(a.user_id, (countByUser.get(a.user_id) ?? 0) + 1);
  }

  const planDistribution: Record<string, number> = { starter: 0, pro: 0, community: 0 };
  let activeSubscriptions = 0;
  let totalAddons = 0;

  const usersWithPlans = (profiles ?? []).map((p) => {
    const sub = subByUser.get(p.id);
    const base = sub?.max_instances ?? 1;
    const userAddons = addonsByUser.get(p.id) ?? 0;
    const effectiveMax = base + userAddons;
    const used = countByUser.get(p.id) ?? 0;

    if (sub) {
      const plan = sub.plan_type as string;
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
      plan: (sub?.plan_type as string) ?? "starter",
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
