import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Convención: los precios se guardan y editan en PESOS ARGENTINOS enteros (sin centavos).
// plan_config.amount_pesos / mercado_pago_config.addon_price_pesos / payments.amount_pesos

// GET: Config de MP + precios de planes
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const mpConfig = await query<{ id: string; public_key: string | null; access_token: string | null; webhook_secret: string | null; addon_price_pesos: number; created_at: string; updated_at: string }>(
    "SELECT id, public_key, access_token, webhook_secret, addon_price_pesos, created_at, updated_at FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  const plans = await query<{ plan_type: string; amount_pesos: number; label: string; description: string | null; max_instances: number }>(
    "SELECT plan_type, amount_pesos, label, description, max_instances FROM plan_config ORDER BY plan_type ASC"
  );

  return NextResponse.json({ status: "success", data: { mp_config: mpConfig?.[0] || null, plans: plans || [] } });
}

// PATCH: Actualiza MP config y/o planes. Cada plan se guarda por separado (upsert por plan_type).
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const payload = body as {
    access_token?: string;
    public_key?: string;
    webhook_secret?: string;
    addon_price_pesos?: number;
    plans?: Array<{ plan_type: string; amount_pesos?: number; label?: string; description?: string; max_instances?: number }>;
  };

  const id = () => String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15));

  // ── MP config: upsert sobre el config más reciente del admin ──────────
  if (
    payload.access_token !== undefined ||
    payload.public_key !== undefined ||
    payload.webhook_secret !== undefined ||
    payload.addon_price_pesos !== undefined
  ) {
    const mpUpdates: Record<string, unknown> = {};
    if (payload.access_token !== undefined) mpUpdates.access_token = payload.access_token;
    if (payload.public_key !== undefined) mpUpdates.public_key = payload.public_key;
    if (payload.webhook_secret !== undefined) mpUpdates.webhook_secret = payload.webhook_secret;
    if (payload.addon_price_pesos !== undefined) mpUpdates.addon_price_pesos = payload.addon_price_pesos;

    try {
      const existing = await query<{ id: string }>(
        "SELECT id FROM mercado_pago_config WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        [auth.user.id]
      );
      if (existing.length > 0) {
        const setClauses = Object.keys(mpUpdates).map((k) => `${k} = ?`);
        await query(
          `UPDATE mercado_pago_config SET ${setClauses.join(", ")}, updated_at = NOW() WHERE id = ?`,
          [...Object.values(mpUpdates), existing[0].id]
        );
      } else {
        await query(
          "INSERT INTO mercado_pago_config (id, user_id, access_token, public_key, webhook_secret, addon_price_pesos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
          [id(), auth.user.id, mpUpdates.access_token ?? null, mpUpdates.public_key ?? null, mpUpdates.webhook_secret ?? null, mpUpdates.addon_price_pesos ?? 0]
        );
      }
    } catch (error) {
      console.error("[admin/mercado-pago] error guardando config MP:", error);
      return NextResponse.json({ status: "error", error: "No se pudo guardar la configuración de Mercado Pago" }, { status: 500 });
    }
  }

  // ── Planes: cada plan se actualiza de forma independiente ─────────────
  if (payload.plans && Array.isArray(payload.plans)) {
    try {
      for (const p of payload.plans) {
        if (!p.plan_type) continue;
        const allowed = new Set(["starter", "pro"]);
        if (!allowed.has(p.plan_type)) continue; // plan_config solo define starter/pro

        await query(
          `INSERT INTO plan_config (plan_type, amount_pesos, label, description, max_instances, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             amount_pesos = COALESCE(VALUES(amount_pesos), amount_pesos),
             label = COALESCE(VALUES(label), label),
             description = COALESCE(VALUES(description), description),
             max_instances = COALESCE(VALUES(max_instances), max_instances),
             updated_at = NOW()`,
          [
            p.plan_type,
            p.amount_pesos ?? 0,
            p.label ?? (p.plan_type === "starter" ? "Starter" : "Pro"),
            p.description ?? null,
            p.max_instances ?? (p.plan_type === "starter" ? 1 : 3),
          ]
        );
      }
    } catch (error) {
      console.error("[admin/mercado-pago] error guardando planes:", error);
      return NextResponse.json({ status: "error", error: "No se pudieron guardar los planes" }, { status: 500 });
    }
  }

  return NextResponse.json({ status: "success" });
}
