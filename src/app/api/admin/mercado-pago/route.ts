import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

// GET: Config de MP + precios de planes
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const [{ rows: mpConfig }] = await query<{ id: string; public_key: string | null; access_token: string | null; webhook_secret: string | null; addon_price_cents: number; created_at: string; updated_at: string }>(
    "SELECT id, public_key, access_token, webhook_secret, addon_price_cents, created_at, updated_at FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  const [{ rows: plans }] = await query<{ plan_type: string; amount_cents: number; label: string; description: string | null; max_instances: number; addon_price_cents: number }>(
    "SELECT plan_type, amount_cents, label, description, max_instances, addon_price_cents FROM plan_config ORDER BY plan_type ASC"
  );

  return NextResponse.json({ status: "success", data: { mp_config: mpConfig?.[0] || null, plans: plans || [] } });
}

// PATCH: Actualizar MP config + precios de planes
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const payload = body as {
    access_token?: string;
    public_key?: string;
    webhook_secret?: string;
    addon_price_cents?: number;
    plans?: Array<{ plan_type: string; amount_cents?: number; label?: string; description?: string; max_instances?: number }>;
  };

  // Actualizar MP config
  if (payload.access_token !== undefined || payload.public_key !== undefined) {
    const updates = {};
    if (payload.access_token !== undefined) updates.access_token = payload.access_token;
    if (payload.public_key !== undefined) updates.public_key = payload.public_key;
    if (payload.webhook_secret !== undefined) updates.webhook_secret = payload.webhook_secret;
    if (payload.addon_price_cents !== undefined) updates.addon_price_cents = payload.addon_price_cents;

    const setClauses = Object.keys(updates).map((k) => `${k} = ?`);
    const values = [...Object.values(updates), updates.updated_at || new Date().toISOString()];
    await query(`INSERT INTO mercado_pago_config (id, user_id, access_token, public_key, webhook_secret, addon_price_cents, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ${setClauses.join(", ")}`,
      [Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), null, updates.access_token, updates.public_key, updates.webhook_secret, updates.addon_price_cents, new Date().toISOString()]);
  }

  // Actualizar precios de planes
  if (payload.plans && Array.isArray(payload.plans)) {
    for (const p of payload.plans) {
      if (!p.plan_type) continue;
      const updates = {};
      if (p.amount_cents !== undefined) updates.amount_cents = p.amount_cents;
      if (p.label !== undefined) updates.label = p.label;
      if (p.description !== undefined) updates.description = p.description;
      if (p.max_instances !== undefined) updates.max_instances = p.max_instances;

      const setClauses = Object.keys(updates).map((k) => `${k} = ?`);
      const values = [...Object.values(updates), new Date().toISOString(), p.plan_type];
      await query(`INSERT INTO plan_config (plan_type, amount_cents, label, description, max_instances, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE ${setClauses.join(", ")}`,
        [p.plan_type, p.amount_cents, p.label, p.description, p.max_instances, new Date().toISOString()]);
    }
  }

  return NextResponse.json({ status: "success" });
}
