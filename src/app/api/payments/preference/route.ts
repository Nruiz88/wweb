import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  // Get MP config from DB
  const [{ rows: mpConfig }] = await query<{ access_token: string | null; public_key: string | null }>(
    "SELECT access_token, public_key FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  if (!mpConfig?.length || !mpConfig[0].access_token) {
    return NextResponse.json({ status: "error", error: "Mercado Pago no configurado" }, { status: 400 });
  }
  const mpConfigData = mpConfig[0];

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { amount_cents, external_ref, title, plan_type = "pro" } = body as { amount_cents?: number; external_ref?: string; title?: string; plan_type?: string };

  let finalAmountCents = (amount_cents && amount_cents > 0) ? amount_cents : null;
  const finalPlanType = (plan_type || "pro");

  if (!finalAmountCents) {
    const [{ rows: planConfig }] = await query<{ amount_cents: number; label: string }>(
      "SELECT amount_cents, label FROM plan_config WHERE plan_type = ? LIMIT 1",
      [finalPlanType]
    );
    if (planConfig?.length && planConfig[0].amount_cents > 0) {
      finalAmountCents = planConfig[0].amount_cents;
    } else {
      return NextResponse.json({ status: "error", error: `Plan ${finalPlanType} no configurado en plan_config o sin precio` }, { status: 400 });
    }
  }

  if (!finalAmountCents || finalAmountCents <= 0) return NextResponse.json({ status: "error", error: "amount_cents required" }, { status: 400 });

  try {
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${mpConfigData.access_token}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: title || "Plan Pro",
            quantity: 1,
            currency_id: "ARS",
            unit_price: finalAmountCents / 100,
          },
        ],
        external_reference: external_ref || session.userId,
        back_urls: {
          success: `${process.env.APP_URL || ""}/dashboard`,
          failure: `${process.env.APP_URL || ""}/dashboard`,
          pending: `${process.env.APP_URL || ""}/dashboard`,
        },
        auto_return: "approved",
        notification_url: `${process.env.APP_URL || ""}/api/webhook/mercadopago`,
      }),
    });

    const mpData = await res.json();
    if (!res.ok) {
      console.error("[mp-preference] MP error:", mpData);
      return NextResponse.json({ status: "error", error: mpData.message || "MP error" }, { status: 502 });
    }

    // Record pending payment
    const [{ insertId }] = await query(
      "INSERT INTO payments (id, user_id, external_id, amount_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())",
      [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), session.userId, String(mpData.id || `mp_${Date.now()}`), finalAmountCents]
    );

    return NextResponse.json({
      status: "success",
      data: {
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    console.error("[mp-preference] error:", message);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
