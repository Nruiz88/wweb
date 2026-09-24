import type { PlanType } from "../../lib/db/types";

export function hasAccessToFeature(planType: PlanType, feature: string): boolean {
  const features: Record<PlanType, string[]> = {
    pending: [],
    starter: ["keywords", "menus"],
    pro: ["keywords", "menus", "calendar", "appointments", "reminders"],
  };

  return features[planType]?.includes(feature) ?? false;
}

export function canCreateInstance(
  currentInstancesCount: number,
  maxInstances: number
): boolean {
  return currentInstancesCount < maxInstances;
}