import { NextResponse } from "next/server";
import { query, select } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function selectOne<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
  return query<T>(sql, params);
}

// Mercado Pago webhook — MariaDB only, JWT authorized, idempotent.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = body as { type?: string; data?: Record<string, unknown> };
  if (type !== "payment_assigned" && type !== "payment_created") {
    return NextResponse.json({ received: true });
  }

  const paymentId = String((data?.id as string) || "");
  const merchantOrderId = String((data?.merchant_order_id as string) || "");
  const externalReference = String((data?.external_reference as string) || "");

  // ── Idempotency: skip if already approved ───────────────────────────────
  const [{ rows: existing }] = await selectOne<{ id: string; status: string; updated_at: string }>(
    "SELECT id, status FROM payments WHERE external_id = ? OR mp_payment_id = ? LIMIT 1",
    [externalReference, paymentId]
  );
  if (existing.length > 0) {
    const p = existing[0];
    if (p.status === "approved") {
      console.log(`[mp] payment ${paymentId} already approved; skip`);
      return NextResponse.json({ received: true, already_approved: true });
    }
    // Otherwise keep processing (e.g. pending → approved)
  }

  // ── Mercado Pago config ────────────────────────────────────────────────
  const [{ rows: mpConfig }] = await selectOne<{ access_token: string | null; public_key: string | null }>(
    "SELECT access_token, public_key FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  if (!mpConfig?.length || !mpConfig[0].access_token) {
    return NextResponse.json({ status: "error", error: "Mercado Pago not configured" }, { status: 500 });
  }
  const mpConfigData = mpConfig[0];

  try {
    const res = await fetch("https://api.mercadopago.com/v1/payments/" + paymentId, {
      headers: { Authorization: `Bearer ${mpConfigData.access_token}` },
    });
    const mpPayment = await res.json();
    if (!res.ok) {
      console.error("[mp] payment fetch error:", mpPayment);
      return NextResponse.json({ received: true });
    }

    const status = String(mpPayment.status || "").toLowerCase();
    const statusDetail = String(mpPayment.status_detail || "");

    if (status === "paid") {
      return NextResponse.json({ received: true });
    }

    if (status === "rejected" || status === "cancelled" || statusDetail?.includes("authentication")) {
      await query(
        "UPDATE payments SET status = 'failed', updated_at = NOW() WHERE external_id = ? OR mp_payment_id = ?",
        [externalReference, paymentId]
      );
      return NextResponse.json({ received: true });
    }

    if (status === "authorized" || status === "in_process" || status === "scheduled") {
      await query(
        "UPDATE payments SET status = 'pending', updated_at = NOW() WHERE external_id = ? OR mp_payment_id = ?",
        [externalReference, paymentId]
      );
      return NextResponse.json({ received: true });
    }

    // Unknown status — do nothing.
    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    console.error("[mp] error:", message);
    return NextResponse.json({ received: true });
  }
}

// ── Plan activation (success/created flow) ──────────────────────────────
async function activatePlan(
  paymentId: string,
  externalReference: string,
  mpPayment: Record<string, unknown>,
  mpConfigData: { access_token: string; public_key: string }
) {
  const status = String(mpPayment.status || "").toLowerCase();

  if (status !== "paid" && status !== "approved") return;

  const [{ rows: existing }] = await selectOne<{ id: string; status: string }>(
    "SELECT id, status FROM payments WHERE external_id = ? OR mp_payment_id = ? LIMIT 1",
    [externalReference, paymentId]
  );
  if (!existing.length || existing[0].status === "approved") return;

  const planType = String(mpPayment.collection_id || "pro");
  const [{ rows: planConfig }] = await selectOne<{ amount_cents: number; label: string }>(
    "SELECT amount_cents, label FROM plan_config WHERE plan_type = ? LIMIT 1",
    [planType]
  );
  const planLabel = planConfig?.[0]?.label || planType;

  // Record payment
  const [{ insertId }] = await query(
    "INSERT INTO payments (id, user_id, external_id, mp_payment_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'approved', NOW(), NOW())",
    [
      String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15),
      externalReference,
      externalReference,
      paymentId,
      planConfig?.[0]?.amount_cents || 0,
    ]
  );

  // Upsert subscription (guarded — account exists by this point)
  try {
    await query(
      `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, created_at, updated_at)
       VALUES (?, ?, ?, 'active', 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         plan_type = VALUES(plan_type),
         status = VALUES(status),
         max_instances = VALUES(max_instances),
         updated_at = NOW()`,
      [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), externalReference, planType]
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "subscription upsert failed";
    console.error("[mp] subscription upsert error:", message);
  }

  // Optional: increment plan counter
  try {
    await query(
      "UPDATE profiles SET plan_type = ?, subscription_status = 'active', upgraded_at = NOW() WHERE id = ?",
      [planType, externalReference]
    );
  } catch {
    // Profiles may not exist in this flow — non-critical
  }

  // Assign/link instance via RPC
  try {
    const [{ rows: assignments }] = await selectOne<{ user_id: string }>(
      "SELECT user_id FROM user_instances WHERE user_id = ? LIMIT 1",
      [externalReference]
    );
    if (assignments?.length) {
      await query(
        "CALL assign_instance_for_user(?)",
        [externalReference]
      );
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "RPC assign_instance_for_user failed";
    console.error("[mp] assign RPC error:", message);
  }

  return { paymentId: insertId, status: "approved" };
}

// Manual activation endpoint (used by dashboard / orders flow).
export async function POSTActivation(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { external_reference, payment_id } = body as { external_reference?: string; payment_id?: string };

  if (!external_reference) {
    return NextResponse.json({ status: "error", error: "external_reference required" }, { status: 400 });
  }

  const [{ rows: existing }] = await selectOne<{ id: string; status: string }>(
    "SELECT id, status FROM payments WHERE external_id = ? OR mp_payment_id = ? LIMIT 1",
    [external_reference, payment_id]
  );
  if (existing.length > 0 && existing[0].status === "approved") {
    return NextResponse.json({ status: "success", already_approved: true });
  }

  await activatePlan(payment_id || "", external_reference, { status: "paid" } as any, {
    access_token: "",
    public_key: "",
  });

  return NextResponse.json({ status: "success" });
}
