"use client";

import { useEffect, useState } from "react";
import type { PlanType } from "@/lib/supabase/types";

/**
 * Hook that fetches the current user's subscription plan.
 * Returns the plan type, whether the user is admin, and loading state.
 */
export function useUserPlan() {
  const [plan, setPlan] = useState<PlanType | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlan() {
      try {
        const [meRes, profileRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/profile?lite=1"),
        ]);

        const mePayload = await meRes.json();
        const profilePayload = await profileRes.json();

        if (cancelled) return;

        if (mePayload.status === "success" && mePayload.data?.role === "admin") {
          setIsAdmin(true);
        }
        if (profilePayload.status === "success" && profilePayload.data?.subscription) {
          setPlan(profilePayload.data.subscription.plan_type);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchPlan();
    return () => { cancelled = true; };
  }, []);

  return { plan, isAdmin, loading };
}
