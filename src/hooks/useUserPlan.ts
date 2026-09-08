"use client";

import { usePlanContext } from "@/components/plan-context";

/**
 * Hook that returns the current user's subscription plan.
 * Lee del PlanProvider del layout (1 solo fetch compartido) en vez de
 * fetchear /api/auth/me + /api/profile?lite=1 en cada página que lo usa.
 */
export function useUserPlan() {
  const { plan, isAdmin, loading } = usePlanContext();
  return { plan, isAdmin, loading };
}
