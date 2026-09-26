"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PlanType } from "@/lib/db/types";

interface PlanState {
  plan: PlanType | null;
  isAdmin: boolean;
  userName: string;
  loading: boolean;
}

const PlanContext = createContext<PlanState | null>(null);

/**
 * Proveedor único de rol/plan/usuario para todo el dashboard.
 * Hace 1 sola vez los fetches (/api/auth/me + /api/profile?lite=1) por
 * montaje del layout, en vez de repetirlos en el layout + cada página
 * que usaba useUserPlan (4 requests duplicados por navegación).
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlanState>({ plan: null, isAdmin: false, userName: "", loading: true });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Rol y plan en paralelo (sin llamadas a Evolution API)
        const [meRes, profileRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/profile?lite=1"),
        ]);
        const mePayload = await meRes.json();
        const profilePayload = await profileRes.json();
        if (cancelled) return;

        let userName = mePayload.data?.full_name || mePayload.data?.email || "";
        let isAdmin = false;
        if (mePayload.status === "success") {
          if (mePayload.data?.role === "admin") {
            isAdmin = true;
            if (mePayload.data.full_name) userName = mePayload.data.full_name;
          }
        }
        setState({
          plan: profilePayload.status === "success" ? profilePayload.data?.subscription?.plan_type ?? null : null,
          isAdmin,
          userName,
          loading: false,
        });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  return <PlanContext.Provider value={state}>{children}</PlanContext.Provider>;
}

export function usePlanContext(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlanContext must be used within PlanProvider");
  return ctx;
}
