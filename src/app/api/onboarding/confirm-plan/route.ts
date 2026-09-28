import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, generateId } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST: Confirm plan selection (starter = free, pro triggers MP preference or manual confirmation)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { planType } = body as { planType?: string };

  if (!planType || !["starter", "pro"].includes(planType)) {
    return NextResponse.json({ status: "error", error: "planType must be starter or pro" }, { status: 400 });
  }

  // Check current subscription status
  const subs = await query<{ plan_type: string; status: string; max_instances: number }>(
    "SELECT plan_type, status, max_instances FROM subscriptions WHERE user_id = ? LIMIT 1",
    [session.userId]
  );
  const sub = subs?.[0];

  if (!sub || sub.status === "pending") {
    if (planType === "starter") {
      const id = generateId();
      const cfg = await query<{ max_instances: number }>(
        "SELECT max_instances FROM plan_config WHERE plan_type = 'starter' LIMIT 1"
      );
      const maxInstances = Number(cfg?.[0]?.max_instances) || 1;
      await query(
        `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, paid_until, purchased_at, created_at, updated_at)
         VALUES (?, ?, 'starter', 'active', ?, NULL, NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           plan_type = VALUES(plan_type),
           status = VALUES(status),
           max_instances = VALUES(max_instances),
           paid_until = VALUES(paid_until),
           purchased_at = VALUES(purchased_at),
           updated_at = NOW()`,
        [id, session.userId, maxInstances]
      );

      // Assign instance if missing
      // Nota: la asignación de instancias se hace desde el panel admin; el usuario
      // también puede crear la suya propia (limitada por el gating de su plan).
      // El SP assign_instance_for_user nunca existió en MariaDB — se elimina la llamada.

      return NextResponse.json({ status: "success", data: { plan: "starter", activated: true } });
    }

    return NextResponse.json({ status: "success", data: { plan: "pro", requires_payment: true, preference_url: "/api/payments/preference" } });
  }

  // ─── BUG CRÍTICO (arreglado) ────────────────────────────────────────────
  // Esta rama escribía `plan_type = <lo que mande el body>` con
  // `status = 'active'` y `paid_until = NULL`, SIN comprobar pago. Como la
  // ruta de cobro real (activatePlan en el webhook de MP) nunca se ejecutaba,
  // un POST `{"planType":"pro"}` con cualquier cookie de sesión válida
  // activaba Pro gratis → todo el producto de pago era evadible.
  //
  // Regla: desde acá solo se puede BAJAR a starter (gratis) o pedir el cobro
  // de un upgrade. Activar Pro requiere un pago verificado por el webhook de
  // Mercado Pago o una acción de admin.
  const isUpgrade = planType === "pro" && sub.plan_type !== "pro";
  if (isUpgrade) {
    return NextResponse.json({
      status: "success",
      data: { plan: sub.plan_type, requires_payment: true, preference_url: "/api/payments/preference" },
    });
  }

  // `max_instances` venía hardcodeado en 1, ignorando `plan_config.max_instances`
  // (pro = 3 en el DDL): un usuario "pro" quedaba limitado a 1 instancia.
  const cfg = await query<{ max_instances: number }>(
    "SELECT max_instances FROM plan_config WHERE plan_type = ? LIMIT 1",
    [planType]
  );
  const maxInstances = Number(cfg?.[0]?.max_instances) || 1;

  const id = generateId();
  await query(
    `INSERT INTO subscriptions (id, user_id, plan_type, status, max_instances, paid_until, purchased_at, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, NULL, NOW(), NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       plan_type = VALUES(plan_type),
       status = VALUES(status),
       max_instances = VALUES(max_instances),
       paid_until = VALUES(paid_until),
       purchased_at = VALUES(purchased_at),
       updated_at = NOW()`,
    [id, session.userId, planType, maxInstances]
  );

  return NextResponse.json({ status: "success", data: { plan: planType, activated: true } });
}
