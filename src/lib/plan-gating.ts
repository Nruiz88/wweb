import { query } from "./db";

export type EffectivePlan = "starter" | "pro";
export type ProFeature = "calendar" | "appointments" | "reminders";

export interface PlanInfo {
  plan: EffectivePlan;
  /** true si el usuario es owner/admin de la instancia (siempre tratado como pro). */
  isAdmin: boolean;
}

/**
 * Resuelve el plan efectivo del usuario sobre una instancia:
 * - Owner de la instancia (admin_id) → siempre "pro" (consistente con el webhook).
 * - Si no, usa su suscripción activa: pro → "pro", starter/pending/ausente → "starter".
 */
export async function getPlanForInstance(userId: string, instanceId: string): Promise<PlanInfo> {
  const adminRows = await query<{ id: string }>(
    "SELECT id FROM instances WHERE id = ? AND admin_id = ? LIMIT 1",
    [instanceId, userId]
  );
  const isAdmin = adminRows.length > 0;
  if (isAdmin) return { plan: "pro", isAdmin };

  const subs = await query<{ plan_type: string }>(
    "SELECT plan_type FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1",
    [userId]
  );
  const plan: EffectivePlan = subs[0]?.plan_type === "pro" ? "pro" : "starter";
  return { plan, isAdmin: false };
}

/** Bloquea features Pro (calendar/appointments/reminders) para usuarios starter. */
export async function requireProFeature(
  userId: string,
  instanceId: string,
  feature: ProFeature
): Promise<PlanInfo | null> {
  const info = await getPlanForInstance(userId, instanceId);
  if (info.plan === "pro") return info;
  return null;
}

export function planForbiddenResponse(feature: ProFeature) {
  return {
    status: 403,
    body: {
      status: "error",
      error: `La función "${feature}" requiere plan Pro.`,
      code: "PLAN_UPGRADE_REQUIRED",
      feature,
    },
  };
}

export interface InstanceLimitResult {
  allowed: boolean;
  reason?: string;
  code?: string;
  used?: number;
  max?: number;
}

/**
 * Límite de instancias según suscripción activa + add-ons comprados.
 * Sin suscripción activa se permite crear 1 instancia (plan starter de entrada).
 */
export async function checkInstanceLimit(userId: string): Promise<InstanceLimitResult> {
  const subs = await query<{ plan_type: string; max_instances: number }>(
    "SELECT plan_type, max_instances FROM subscriptions WHERE user_id = ? AND status = 'active' LIMIT 1",
    [userId]
  );

  const addonsRows = await query<{ quantity: number }>(
    "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM instance_addons WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  const addons = Number(addonsRows[0]?.quantity) || 0;

  // Sin sub activa → starter de facto con 1 instancia.
  const base = subs.length > 0 ? Math.max(0, Number(subs[0].max_instances) || 0) : 1;
  const max = base + addons;

  const owned = await query<{ count: number }>(
    "SELECT COUNT(*) AS count FROM instances WHERE admin_id = ?",
    [userId]
  );
  const used = Number(owned[0]?.count) || 0;

  if (used >= max) {
    return {
      allowed: false,
      code: "INSTANCE_LIMIT_REACHED",
      reason:
        `Alcanzaste el límite de ${max} bot${max === 1 ? "" : "s"} de tu plan${addons > 0 ? ` (${base} del plan + ${addons} add-on${addons === 1 ? "" : "s"})` : ""}. ` +
        `Mejorá tu plan o comprá un bot extra para agregar más.`,
      used,
      max,
    };
  }
  return { allowed: true, used, max };
}
