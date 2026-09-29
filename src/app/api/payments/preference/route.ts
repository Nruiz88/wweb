import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, generateId } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "mp-preference", { maxRequests: 10, windowMs: 10 * 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  // Get MP config from DB
  const mpConfig = await query<{ access_token: string | null; public_key: string | null }>(
    "SELECT access_token, public_key FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
  );
  if (!mpConfig?.length || !mpConfig[0].access_token) {
    return NextResponse.json({ status: "error", error: "Mercado Pago no configurado" }, { status: 400 });
  }
  const mpConfigData = mpConfig[0];

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { plan_type = "pro" } = body as { plan_type?: string };

  // ─── BUGS ARREGLA ───────────────────────────────────────────────────────
  // 1. `amount_pesos` venía del body: el cliente fijaba el importe (una
  //    preferencia de $1 activates el Pro completo).
  // 2. `external_ref` del body SOBRESCRIBÍA al session.userId: el pago se
  //    asociaba al usuario que el cliente indicara.
  // 3. `plan_type` no se validaba contra plan_config.
  // Ahora el precio y la referencia salen SIEMPRE del servidor.
  const finalPlanType = plan_type === "starter" ? "starter" : "pro";

  const planConfig = await query<{ amount_pesos: number; label: string }>(
    "SELECT amount_pesos, label FROM plan_config WHERE plan_type = ? LIMIT 1",
    [finalPlanType]
  );
  if (!planConfig?.length || !(planConfig[0].amount_pesos > 0)) {
    return NextResponse.json({ status: "error", error: `Plan ${finalPlanType} no configurado en plan_config o sin precio` }, { status: 400 });
  }
  const finalAmount = planConfig[0].amount_pesos;
  const finalTitle = planConfig[0].label || `Plan ${finalPlanType}`;

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
            title: finalTitle,
            quantity: 1,
            currency_id: "ARS",
            unit_price: finalAmount,
          },
        ],
        // Forzado al usuario autenticado: el body ya no puede elegir a quién
        // se le acredita el pago.
        external_reference: session.userId,
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

    // Record pending payment. El `mp_payment_id` real se guarda acá para que el
    // webhook de MP pueda matchear por el id de la preferencia (el `external_id`
    // es el id de la preferencia, no el de la preferencia de pago).
    await query(
      "INSERT INTO payments (id, user_id, external_id, amount_pesos, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())",
      [generateId(), session.userId, String(mpData.id || `mp_${Date.now()}`), finalAmount]
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
