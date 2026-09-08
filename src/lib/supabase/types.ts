export type PlanType = "pending" | "starter" | "pro";
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
  | "reminders";

export const PLAN_FEATURES: Record<PlanType, PlanFeature[]> = {
  pending: [],
  starter: ["keywords", "menus"],
  pro: ["keywords", "menus", "calendar", "appointments", "reminders"],
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
  welcome_message: string | null;
  outside_hours_message: string | null;
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

export type ResponseType = "text" | "menu";

export interface MenuButton {
  id: string;
  text: string;
  /** Target auto_response_id — when tapped, the bot sends that response.
   *  null means the button only sends its display text back as a keyword match. */
  target_id: string | null;
}

export interface MenuConfig {
  title: string;
  description: string;
  footer?: string;
  buttons: MenuButton[];
}

export interface AutoResponse {
  id: string;
  instance_id: string;
  user_id: string;
  keyword: string | null;
  regex_pattern: string | null;
  response_text: string;
  response_media_url: string | null;
  response_type: ResponseType;
  menu_config: MenuConfig | null;
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

// ============================================
// Calendar / Appointments (Pro plan)
// ============================================

export type AppointmentStatus = "pending" | "confirmed" | "canceled" | "completed";

export interface BusinessHours {
  id: string;
  instance_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_min: number;
  is_active: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  instance_id: string;
  user_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_min: number;
  status: AppointmentStatus;
  notes: string | null;
  reminder_24h_sent: boolean;
  created_at: string;
  updated_at: string;
}

/** Available time slot for a given date */
export interface TimeSlot {
  time: string;
  display: string;
}

/** Calendar day summary shown to the user */
export interface CalendarDay {
  date: string;
  display: string;
  dayOfWeek: string;
  available: boolean;
  slotCount: number;
}

// ============================================
// Catalog / Orders (generic)
// ============================================

export interface CatalogItem {
  id: string;
  instance_id: string;
  label: string;
  description: string | null;
  price_cents: number;
  active: boolean;
  sort_order: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "completed" | "canceled";

export interface Order {
  id: string;
  instance_id: string;
  user_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  catalog_item_id: string | null;
  option_label: string;
  price_cents: number;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}


