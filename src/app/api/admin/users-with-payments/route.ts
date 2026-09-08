import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const [subs, payments, addons, profiles] = await Promise.all([
    supabase.from("subscriptions").select("user_id, plan_type, status, max_instances, paid_until, purchased_at, updated_at"),
    supabase.from("payments").select("user_id, status, amount_cents, created_at, updated_at"),
    supabase.from("instance_addons").select("user_id, quantity, status, updated_at"),
    supabase.from("profiles").select("id, email, full_name, role, created_at"),
  ]);

  const subByUser = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
  interface PaymentRow { user_id: string; created_at: string; amount_cents?: number; status?: string }
  const payLatest: Record<string, PaymentRow> = {};
  ((payments.data ?? []) as PaymentRow[]).forEach((p) => {
    if (!payLatest[p.user_id] || new Date(p.created_at) > new Date(payLatest[p.user_id].created_at)) {
      payLatest[p.user_id] = p;
    }
  });
  const addonByUser = new Map<string, number>();
  ((addons.data ?? []) as Array<{ user_id: string; quantity?: number; status?: string }>).forEach((a) => {
    if (a.status === "active") addonByUser.set(a.user_id, (addonByUser.get(a.user_id) || 0) + (a.quantity || 0));
  });

  interface ProfileRow { id: string; email: string; full_name: string; role: string; created_at: string }
  const users = ((profiles.data ?? []) as ProfileRow[]).map((p) => {
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
