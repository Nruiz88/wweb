"use client";

import type { PlanType } from "@/lib/supabase/types";
import { ShieldIcon, ArrowRightIcon } from "@/components/icons";

const PLAN_META: Record<string, { label: string; color: string; price: string }> = {
  starter: { label: "Starter", color: "#53bdeb", price: "$12.000" },
  pro: { label: "Pro", color: "#00a884", price: "$22.000" },
  community: { label: "Community", color: "#e6a44e", price: "$35.000" },
};

const PLAN_HIERARCHY: PlanType[] = ["starter", "pro", "community"];

interface PlanPaywallProps {
  /** The minimum plan required to access this feature */
  requiredPlan: PlanType;
  /** The user's current plan */
  currentPlan: PlanType | null;
  /** Whether the user is an admin (admins bypass all paywalls) */
  isAdmin: boolean;
  /** The feature name to display */
  featureName: string;
  /** Feature description */
  description: string;
}

export default function PlanPaywall({
  requiredPlan,
  currentPlan,
  isAdmin,
  featureName,
  description,
}: PlanPaywallProps) {
  // Admins always have access
  if (isAdmin) return null;

  // Check if user's plan meets the requirement
  const currentIdx = currentPlan ? PLAN_HIERARCHY.indexOf(currentPlan) : -1;
  const requiredIdx = PLAN_HIERARCHY.indexOf(requiredPlan);

  if (currentIdx >= requiredIdx) return null;

  const requiredMeta = PLAN_META[requiredPlan];

  return (
    <div className="flex h-full flex-col items-center justify-center bg-wa-panel p-6">
      <div className="mx-auto max-w-sm text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-wa-header to-wa-panel ring-4 ring-wa-border/30">
          <ShieldIcon className="h-10 w-10 text-wa-text-secondary/30" />
        </div>

        <h2 className="text-xl font-bold text-wa-text">{featureName}</h2>
        <p className="mt-2 text-sm text-wa-text-secondary">{description}</p>

        {/* Required plan badge */}
        <div className="mt-6 rounded-xl border border-wa-border bg-wa-header p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-wa-text-secondary/60">
            Requiere plan
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ backgroundColor: `${requiredMeta.color}15`, color: requiredMeta.color }}
            >
              {requiredMeta.label}
            </span>
            <span className="text-sm text-wa-text-secondary">
              {requiredMeta.price}/mes
            </span>
          </div>

          {currentPlan && (
            <p className="mt-3 text-xs text-wa-text-secondary/60">
              Tu plan actual: <span className="font-semibold text-wa-text-secondary">{PLAN_META[currentPlan]?.label || currentPlan}</span>
            </p>
          )}
        </div>

        {/* Upgrade CTA */}
        <a
          href="https://wa.me/5491112345678?text=Hola%20Boti%2C%20quiero%20upgradear%20mi%20plan"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:shadow-xl hover:shadow-[#00a884]/35 hover:scale-[1.02]"
        >
          Upgradear a {requiredMeta.label}
          <ArrowRightIcon className="h-4 w-4" />
        </a>

        <p className="mt-3 text-[11px] text-wa-text-secondary/40">
          Contactanos para activar tu plan
        </p>
      </div>
    </div>
  );
}
