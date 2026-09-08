// Mercado Pago webhook (public endpoint)
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();

    // Read webhook body
    const body = await request.json();
    const { data: notification, type } = body ?? {};

    console.log("[mp-webhook] received type=", type, "id=", notification?.id, "external_reference=", notification?.external_reference);

    // Mercado Pago sends notifications with topic=payment and data.id = payment id
    // We treat any body with data.id as a payment notification.
    if (!notification?.id) {
      return NextResponse.json({ status: "ok" });
    }

    const mpPaymentId = String(notification.id);

    // Find MP config
    const { data: mpConfig } = await supabase
      .from("mercado_pago_config")
      .select("access_token, webhook_secret")
      .limit(1)
      .maybeSingle();

    if (!mpConfig?.access_token) {
      console.error("[mp-webhook] no MP config");
      return NextResponse.json({ status: "ok" });
    }

    // Optionally verify webhook_secret if configured
    // MP webhook signature verification can be done by comparing headers if needed.

    // Fetch payment details from MP to verify status
    try {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${mpConfig.access_token}` },
      });

      if (!mpRes.ok) {
        console.error("[mp-webhook] MP fetch error", mpRes.status);
        return NextResponse.json({ status: "ok" });
      }

      const mpData = await mpRes.json();
      const status = mpData.status; // approved, rejected, pending, cancelled
      const externalReference = mpData.external_reference || null;
      const amount = mpData.transaction_amount || 0;

      console.log("[mp-webhook] MP status for", mpPaymentId, "=", status, "ref=", externalReference, "amount=", amount);

      // Find our payment record by external_id (MP payment id or external_reference)
      const searchId = mpData.id ? String(mpData.id) : mpPaymentId;

      const { data: existing } = await supabase
        .from("payments")
        .select("id, user_id, status, plan_activated")
        .or(`external_id.eq.${searchId},external_id.eq.${externalReference}`)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        // If no existing record, create one (backfill / direct MP reference)
        if (status === "approved") {
          // We need user from external_reference (user UUID in our DB)
          const userUuid = externalReference && externalReference.length === 36 ? externalReference : null;
          if (userUuid) {
            await supabase.from("payments").insert({
              user_id: userUuid,
              external_id: String(mpData.id || mpPaymentId),
              amount_cents: Math.round((amount || 0) * 100),
              status: "approved",
              plan_activated: true,
            });
          }
        }
        return NextResponse.json({ status: "ok" });
      }

      // If already processed and activated, skip
      if (existing.plan_activated && status === "approved") {
        return NextResponse.json({ status: "ok" });
      }

      // Update payment record
      await supabase.from("payments").update({
        status: status,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);

      // If approved, activate subscription and assign instance
      if (status === "approved" && !existing.plan_activated) {
        const userId = existing.user_id;

        if (userId) {
          // Activate subscription to Pro
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            plan_type: "starter",
            status: "active",
            max_instances: 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          // Try to assign instance if user has no assignment
          const { data: assignments } = await supabase
            .from("user_instances")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

          if (!assignments || assignments.length === 0) {
            // Call DB function assign_instance_for_user
            await supabase.rpc("assign_instance_for_user", { p_user_id: userId });
          }

          // Mark payment as activated
          await supabase.from("payments").update({
            plan_activated: true,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        }

        console.log("[mp-webhook] Activated pro plan for user", userId, "from payment", searchId);
      }

      return NextResponse.json({ status: "ok" });
    } catch (e: unknown) {
      console.error("[mp-webhook] processing error:", e instanceof Error ? e.message : String(e));
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }
  } catch (e: unknown) {
    console.error("[mp-webhook] unexpected error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}