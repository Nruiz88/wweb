export type PlanType = "starter" | "pro" | "community";
export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type InstanceStatus = "open" | "close" | "connecting" | "qrcode";

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  max_instances: number;
  created_at: string;
  updated_at: string;
}

export interface InstanceAddon {
  id: string;
  user_id: string;
  quantity: number;
  status: "active" | "canceled";
  created_at: string;
  updated_at: string;
}

export type PlanFeature =
  | "keywords"
  | "menus"
  | "calendar"
  | "appointments"
  | "reminders"
  | "group_moderation"
  | "broadcasts";

export const PLAN_FEATURES: Record<PlanType, PlanFeature[]> = {
  starter: ["keywords", "menus"],
  pro: ["keywords", "menus", "calendar", "appointments", "reminders"],
  community: ["keywords", "menus", "group_moderation", "broadcasts"],
};

export function hasPlanFeature(plan: PlanType, feature: PlanFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "user";
  business_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface Instance {
  id: string;
  admin_id: string;
  instance_name: string;
  evolution_api_url: string;
  evolution_api_key: string;
  status: InstanceStatus;
  created_at: string;
}

// Safe instance view (no API keys)
export interface InstancePublic {
  id: string;
  instance_name: string;
  status: InstanceStatus;
  created_at: string;
}

export interface UserInstance {
  id: string;
  user_id: string;
  instance_id: string;
  assigned_at: string;
}

export interface AutoResponse {
  id: string;
  instance_id: string;
  user_id: string;
  keyword: string | null;
  regex_pattern: string | null;
  response_text: string;
  response_media_url: string | null;
  is_active: boolean;
  priority: number;
  schedule: {
    from?: string;
    to?: string;
  } | null;
  created_at: string;
}

export interface ResponseLog {
  id: string;
  instance_id: string;
  auto_response_id: string | null;
  user_id: string | null;
  incoming_phone: string;
  incoming_message: string;
  matched_keyword: string | null;
  sent_at: string;
}
