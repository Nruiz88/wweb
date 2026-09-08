import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createServerClient();

  // Verify auth
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const user = userData.user;

  // Get MP config from DB
  const { data: mpConfig } = await supabase
    .from("mercado_pago_config")
    .select("access_token, public_key")
    .limit(1)
    .maybeSingle();

  if (!mpConfig?.access_token) {
    return NextResponse.json({ status: "error", error: "Mercado Pago no configurado" }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { amount_cents, external_ref, title, plan_type = "pro" } = (body ?? {}) as {
    amount_cents?: number;
    external_ref?: string;
    title?: string;
    plan_type?: string;
  };

  // Si no se envió amount_cents o es 0, buscar en plan_config
  let finalAmountCents = (amount_cents && amount_cents > 0) ? amount_cents : null;
  const finalPlanType = (plan_type || "pro");

  if (!finalAmountCents) {
    const { data: planConfig } = await supabase
      .from("plan_config")
      .select("amount_cents, label")
      .eq("plan_type", finalPlanType)
      .maybeSingle();
    if (planConfig && planConfig.amount_cents > 0) {
      finalAmountCents = planConfig.amount_cents;
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
        "Authorization": `Bearer ${mpConfig.access_token}`,
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
        external_reference: external_ref || user.id,
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
    const { error: insertErr } = await supabase.from("payments").insert({
      user_id: user.id,
      external_id: String(mpData.id || `mp_${Date.now()}`),
      amount_cents: finalAmountCents,
      status: "pending",
    });

    if (insertErr) console.error("[mp-preference] db insert error:", insertErr);

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
