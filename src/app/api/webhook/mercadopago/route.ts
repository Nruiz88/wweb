import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { query, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Verifica la firma `x-signature` de Mercado Pago.
 *
 * Manifest según la spec de MP:
 *   `id:{data.id};request-id:{x-request-id};ts:{ts};` + secret, con SHA-256.
 *
 * Es OBLIGATORIA: sin ella, este endpoint público permite a cualquiera
 * forjar un POST y activarse el plan Pro a cualquier `external_reference`.
 */
function verifyMpSignature(
  request: Request,
  payload: { data?: { id?: unknown } },
  secret: string,
): boolean {
  const signature = request.headers.get("x-signature");
  const ts = request.headers.get("x-ts");
  const requestId = request.headers.get("x-request-id");
  const dataId = String(payload?.data?.id ?? "");

  if (!signature || !ts || !dataId) return false;

  // Ventana de 5 minutos contra replay.
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum * 1000) > 5 * 60_000) return false;

  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Mercado Pago webhook (server-to-server, sin sesión de usuario).
export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 });
  }

  let body: { type?: string; data?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  // ── Config ─────────────────────────────────────────────────────────────
  const mpConfig = await query<{ access_token: string | null; webhook_secret: string | null }>(
    "SELECT access_token, webhook_secret FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  if (!mpConfig?.length || !mpConfig[0].access_token) {
    return NextResponse.json({ status: "error", error: "Mercado Pago not configured" }, { status: 500 });
  }
  const { access_token, webhook_secret } = mpConfig[0];

  // ── Firma (fail-closed) ────────────────────────────────────────────────
  if (!webhook_secret) {
    console.error("[mp] webhook_secret no configurado — se rechaza el webhook");
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }
  if (!verifyMpSignature(request, body, webhook_secret)) {
    console.warn("[mp] firma inválida", { type: body.type });
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { type, data } = body;
  if (type !== "payment_assigned" && type !== "payment_created") {
    return NextResponse.json({ received: true });
  }

  const paymentId = String(data?.id ?? "");
  if (!paymentId) return NextResponse.json({ received: true });

  try {
    // paymentId va a un path: sin encode se podría traversed.
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const mpPayment = await res.json();
    if (!res.ok) {
      console.error("[mp] no se pudo leer el pago", res.status, paymentId);
      return NextResponse.json({ received: true });
    }

    // `preference_id` es lo que guardamos como `payments.external_id` al crear
    // la preferencia. Matchear por ahí es determinista; antes se buscaba por
    // `external_reference` (el userId) o por `mp_payment_id` (que el INSERT de
    // la preferencia dejaba NULL) → nunca encontraba nada.
    const preferenceId = String(mpPayment.preference_id ?? "");
    const externalReference = String(mpPayment.external_reference ?? "");

    const existing = await query<{
      id: string; status: string; user_id: string | null; external_id: string; amount_pesos: number;
    }>(
      `SELECT id, status, user_id, external_id, amount_pesos FROM payments
       WHERE external_id = ? OR mp_payment_id = ? LIMIT 1`,
      [preferenceId, paymentId]
    );
    if (existing.length > 0 && existing[0].status === "approved") {
      return NextResponse.json({ received: true, already_approved: true });
    }

    const status = String(mpPayment.status || "").toLowerCase();
    const statusDetail = String(mpPayment.status_detail || "");

    // ── Pago rechazado / cancelado ───────────────────────────────────────
    if (status === "rejected" || status === "cancelled" || statusDetail?.includes("authentication")) {
      // El CHECK de `payments.status` es (pending, approved, rejected,
      // cancelled). Se usaba 'failed', que no existe → ER 3819 tragado por el
      // catch y el pago quedaba 'pending' para siempre.
      if (existing.length > 0) {
        await query("UPDATE payments SET status = 'cancelled', mp_payment_id = ?, updated_at = NOW() WHERE id = ?", [
          paymentId,
          existing[0].id,
        ]);
      }
      return NextResponse.json({ received: true });
    }

    // ── Pago en proceso ──────────────────────────────────────────────────
    if (status === "authorized" || status === "in_process" || status === "scheduled" || status === "pending") {
      if (existing.length > 0) {
        await query("UPDATE payments SET mp_payment_id = ?, updated_at = NOW() WHERE id = ?", [
          paymentId,
          existing[0].id,
        ]);
      }
      return NextResponse.json({ received: true });
    }

    if (status !== "approved" && status !== "paid") {
      return NextResponse.json({ received: true });
    }

    // ── Pago aprobado → activar plan ─────────────────────────────────────
    //
    // El usuario SIEMPRE viene de `payments/external_reference` (que
    // /api/payments/preference fuerza a session.userId), nunca del body del
    // webhook. Antes se tomaba `externalReference` directo del body forjado.
    const userId = existing[0]?.user_id || externalReference;
    if (!userId) {
      console.error("[mp] pago aprobado sin external_reference", paymentId);
      return NextResponse.json({ received: true });
    }

    const planConfig = await query<{ max_instances: number }>(
      "SELECT max_instances FROM plan_config WHERE plan_type = 'pro' LIMIT 1"
    );
    const maxInstances = Number(planConfig?.[0]?.max_instances) || 1;
    const amountPesos = Number(mpPayment.transaction_amount ?? existing[0]?.amount_pesos ?? 0);

    if (existing.length > 0) {
      await query(
        "UPDATE payments SET status = 'approved', mp_payment_id = ?, amount_pesos = ?, updated_at = NOW() WHERE id = ?",
        [paymentId, Math.max(0, Math.round(amountPesos)), existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO payments (id, user_id, external_id, mp_payment_id, amount_pesos, status, plan_activated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'approved', true, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           status = 'approved',
           mp_payment_id = VALUES(mp_payment_id),
           plan_activated = true,
           updated_at = NOW()`,
        [generateId(), userId, preferenceId || `mp_${paymentId}`, paymentId, Math.max(0, Math.round(amountPesos))]
      );
    }

    // El plan SIEMPRE es 'pro': antes se leía `mpPayment.collection_id`, que
    // es un id numérico de MP → violaba el CHECK plan_type IN ('starter','pro')
    // y la activación fallaba silenciosamente.
    await query(
      `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, paid_until, purchased_at, created_at, updated_at)
       VALUES (?, ?, 'pro', 'active', ?, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         plan_type = 'pro',
         status = 'active',
         max_instances = VALUES(max_instances),
         paid_until = VALUES(paid_until),
         purchased_at = NOW(),
         updated_at = NOW()`,
      [generateId(), userId, maxInstances]
    );

    return NextResponse.json({ received: true, activated: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    console.error("[mp] error:", message);
    return NextResponse.json({ received: true });
  }
}
