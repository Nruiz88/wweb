import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const [subs, payments, assignments] = await Promise.all([
    supabase.from("subscriptions").select("user_id, plan_type, status, max_instances, paid_until, purchased_at"),
    supabase.from("payments").select("user_id, status, amount_cents, created_at").order("created_at", { ascending: false }),
    supabase.from("user_instances").select("user_id, instance_id"),
  ]);

  const subByUser = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
  interface PaymentRow { user_id: string; created_at: string; amount_cents?: number; status?: string }
  const payLatest: Record<string, PaymentRow> = {};
  ((payments.data ?? []) as PaymentRow[]).forEach((p) => {
    if (!payLatest[p.user_id] || new Date(p.created_at) > new Date(payLatest[p.user_id].created_at)) {
      payLatest[p.user_id] = p;
    }
  });
  const assignedSet = new Set(((assignments.data ?? []) as Array<{ user_id: string }>).map((a) => a.user_id));

  interface ProfileRow { id: string; email: string; full_name: string; role: string; created_at: string }
  const data = ((users ?? []) as ProfileRow[]).map((u) => {
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
