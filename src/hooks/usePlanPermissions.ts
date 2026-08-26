"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { PlanType, Subscription } from "@/lib/supabase/types";
import { canCreateInstance, hasAccessToFeature } from "@/lib/permissions";

export interface PlanPermissions {
  subscription: Subscription | null;
  instances: { id: string; instance_name: string; status: string }[];
  loading: boolean;
  plan: PlanType;
  hasFeature: (feature: string) => boolean;
  canAddBot: boolean;
}

export function usePlanPermissions(): PlanPermissions {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [instances, setInstances] = useState<{ id: string; instance_name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setInstances([]);
        return;
      }

      const [subRes, assignRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("user_instances").select("instance_id").eq("user_id", user.id),
      ]);

      setSubscription((subRes.data as Subscription | null) ?? null);

      const assignedIds = (assignRes.data ?? []).map((a) => a.instance_id);
      if (assignedIds.length === 0) {
        setInstances([]);
        return;
      }

      const { data: instData } = await supabase
        .from("instances")
        .select("id, instance_name, status")
        .in("id", assignedIds);

      setInstances((instData ?? []) as { id: string; instance_name: string; status: string }[]);
    } catch {
      setSubscription(null);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const plan: PlanType = subscription?.plan_type ?? "starter";
  const maxInstances = subscription?.max_instances ?? 1;

  const hasFeature = useCallback(
    (feature: string) => hasAccessToFeature(plan, feature),
    [plan]
  );

  const canAddBot = canCreateInstance(instances.length, maxInstances);

  return { subscription, instances, loading, plan, hasFeature, canAddBot };
}