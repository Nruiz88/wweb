import { query } from "./db";
import { formatArs } from "./format";

// Convención: precios en PESOS ARGENTINOS ENTEROS (sin centavos), leídos de plan_config.
// Fallbacks = valores actuales en producción (se usan solo si la DB no responde).
export const FALLBACK_ADDON_PRICE_PESOS = 7000;

export const FALLBACK_PLANS = [
  {
    plan_type: "starter",
    label: "Starter",
    description: "Para pymes pequeñas",
    amount_pesos: 18000,
    max_instances: 1,
  },
  {
    plan_type: "pro",
    label: "Pro",
    description: "Para negocios en crecimiento",
    amount_pesos: 25000,
    max_instances: 3,
  },
] as const;

export interface PublicPlan {
  plan_type: string;
  label: string;
  description: string | null;
  amount_pesos: number;
  max_instances: number;
}

export interface PlansData {
  plans: PublicPlan[];
  addon_price_pesos: number;
}

/**
 * Lee los precios públicos desde la DB (plan_config + mercado_pago_config).
 * Nunca lanza: si la DB falla devuelve los fallback para que la landing
 * siempre muestre precios coherentes.
 */
export async function getPublicPlans(): Promise<PlansData> {
  try {
    const planRows = await query<{
      plan_type: string;
      amount_pesos: number;
      label: string;
      description: string | null;
      max_instances: number;
    }>(
      "SELECT plan_type, amount_pesos, label, description, max_instances FROM plan_config ORDER BY FIELD(plan_type, 'starter', 'pro') ASC"
    );

    let addon = FALLBACK_ADDON_PRICE_PESOS;
    try {
      const addonRows = await query<{ addon_price_pesos: number }>(
        "SELECT addon_price_pesos FROM mercado_pago_config ORDER BY updated_at DESC LIMIT 1"
      );
      if (addonRows[0]?.addon_price_pesos != null) {
        addon = Math.max(0, Math.round(Number(addonRows[0].addon_price_pesos)) || 0);
      }
    } catch {
      // addon_pricePesos es best-effort; si falla se usa el fallback.
    }

    const plans: PublicPlan[] =
      planRows && planRows.length > 0
        ? planRows
            .filter((p) => p.plan_type === "starter" || p.plan_type === "pro")
            .map((p) => ({
              plan_type: p.plan_type,
              label: p.label || (p.plan_type === "starter" ? "Starter" : "Pro"),
              description: p.description,
              amount_pesos: Math.max(0, Math.round(Number(p.amount_pesos)) || 0),
              max_instances: Math.max(1, Math.round(Number(p.max_instances)) || 1),
            }))
        : [...FALLBACK_PLANS];

    return { plans, addon_price_pesos: addon };
  } catch (error) {
    console.error("[plans] fallback por error de DB:", error);
    return { plans: [...FALLBACK_PLANS], addon_price_pesos: FALLBACK_ADDON_PRICE_PESOS };
  }
}

// formatArs vive en ./format (módulo puro, seguro para el bundle de cliente).
export { formatArs };
