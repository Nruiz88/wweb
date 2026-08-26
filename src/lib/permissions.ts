import type { PlanType } from "@/lib/supabase/types";

export function hasAccessToFeature(planType: PlanType, feature: string): boolean {
  const features: Record<PlanType, string[]> = {
    starter: ["keywords", "menus"],
    pro: ["keywords", "menus", "calendar", "appointments", "reminders"],
    community: ["keywords", "menus", "group_moderation", "broadcasts"],
  };

  return features[planType]?.includes(feature) ?? false;
}

export function canCreateInstance(
  currentInstancesCount: number,
  maxInstances: number
): boolean {
  return currentInstancesCount < maxInstances;
}