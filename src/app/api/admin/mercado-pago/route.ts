import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

// GET: Config de MP + precios de planes
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data: mpConfig } = await supabase
    .from("mercado_pago_config")
    .select("id, public_key, access_token, webhook_secret, addon_price_cents, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: plans } = await supabase
    .from("plan_config")
    .select("plan_type, amount_cents, label, description, max_instances, addon_price_cents")
    .order("plan_type", { ascending: true });

  return NextResponse.json({ status: "success", data: { mp_config: mpConfig, plans: plans || [] } });
}

// PATCH: Actualizar MP config + precios de planes
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    access_token?: string;
    public_key?: string;
    webhook_secret?: string;
    addon_price_cents?: number;
    plans?: Array<{
      plan_type: string;
      amount_cents?: number;
      label?: string;
      description?: string;
      max_instances?: number;
    }>;
  };

  // Actualizar MP config si se envió
  if (payload.access_token !== undefined || payload.public_key !== undefined) {
    const updates: { access_token?: string; public_key?: string; webhook_secret?: string; addon_price_cents?: number } = {};
    if (payload.access_token !== undefined) updates.access_token = payload.access_token;
    if (payload.public_key !== undefined) updates.public_key = payload.public_key;
    if (payload.webhook_secret !== undefined) updates.webhook_secret = payload.webhook_secret;
    if (payload.addon_price_cents !== undefined) updates.addon_price_cents = payload.addon_price_cents;

    await supabase.from("mercado_pago_config").upsert(
      updates,
      { onConflict: "id" }
    );
  }

  // Actualizar precios de planes
  if (payload.plans && Array.isArray(payload.plans)) {
    for (const p of payload.plans) {
      if (!p.plan_type) continue;
      const updates: { amount_cents?: number; label?: string; description?: string; max_instances?: number } = {};
      if (p.amount_cents !== undefined) updates.amount_cents = p.amount_cents;
      if (p.label !== undefined) updates.label = p.label;
      if (p.description !== undefined) updates.description = p.description;
      if (p.max_instances !== undefined) updates.max_instances = p.max_instances;
      await supabase.from("plan_config").upsert(
        { plan_type: p.plan_type, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "plan_type" }
      );
    }
  }

  return NextResponse.json({ status: "success" });
}
