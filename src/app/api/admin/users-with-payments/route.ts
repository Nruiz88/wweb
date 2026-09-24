import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const [{ rows: subs }] = await query<{ user_id: string; plan_type: string; status: string; max_instances: number; paid_until: string | null; purchased_at: string | null }>(
    "SELECT user_id, plan_type, status, max_instances, paid_until, purchased_at FROM subscriptions"
  );
  const [{ rows: payments }] = await query<{ user_id: string; status: string; amount_cents: number; created_at: string }>(
    "SELECT user_id, status, amount_cents, created_at FROM payments"
  );
  const [{ rows: addons }] = await query<{ user_id: string; quantity: number; status: string }>(
    "SELECT user_id, quantity, status FROM instance_addons"
  );
  const [{ rows: profiles }] = await query<{ id: string; email: string; full_name: string; role: string; created_at: string }>(
    "SELECT id, email, full_name, role, created_at FROM profiles"
  );

  const subByUser = new Map(subs.map((s) => [s.user_id, s]));
  const payLatest = {};
  for (const p of payments) {
    if (!payLatest[p.user_id] || new Date(p.created_at) > new Date(payLatest[p.user_id].created_at)) {
      payLatest[p.user_id] = p;
    }
  }
  const addonByUser = new Map();
  for (const a of addons) {
    if (a.status === "active") {
      addonByUser.set(a.user_id, (addonByUser.get(a.user_id) || 0) + (a.quantity || 0));
    }
  }

  const users = (profiles || []).map((p) => {
    const sub = subByUser.get(p.id);
    const latestPay = payLatest[p.id];
    const addonCount = addonByUser.get(p.id) || 0;
    return {
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      created_at: p.created_at,
      plan: sub?.plan_type || "pending",
      status: sub?.status || "pending",
      max_instances: (sub?.max_instances || 0) + addonCount,
      paid_until: sub?.paid_until || null,
      purchased_at: sub?.purchased_at || null,
      latest_payment_amount: latestPay?.amount_cents || 0,
      latest_payment_status: latestPay?.status || "pending",
      addons: addonCount,
    };
  });

  return NextResponse.json({ status: "success", data: users });
}
