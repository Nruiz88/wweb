// MariaDB (Postgres-compatible) types for the WhatsApp dashboard application.
// These replace ../../lib/db/types — the application uses only these types.

export type PlanType = "pending" | "starter" | "pro";

export interface MenuConfig {
  id?: string;
  title: string;
  description: string;
  footer?: string;
  buttons: Array<{ id: string; text: string; target_id: string | null }>;
}

// ── Booking date/time helpers (shared by webhook handlers) ───────────────
export const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function localDateStr(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function localTimeMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export type UserRole = "admin" | "user";
export type InstanceStatus = "open" | "close" | "connecting" | "qrcode";
export type AddonStatus = "active" | "canceled";
export type SubscriptionStatus = "pending" | "active" | "past_due" | "canceled";
export type AppointmentStatus = "pending" | "confirmed" | "canceled" | "completed";
export type ResponseType = "text" | "menu";
export type ResponseLogStatus = "processed" | "failed" | "skipped";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  max_instances: number;
  paid_until: string | null;
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface InstanceAddon {
  id: string;
  user_id: string;
  quantity: number;
  status: AddonStatus;
  created_at: string;
  updated_at: string;
}

export interface Instance {
  id: string;
  admin_id: string;
  instance_name: string;
  evolution_api_url: string;
  evolution_api_key: string;
  status: InstanceStatus;
  status_checked_at: string | null;
  welcome_message: string | null;
  outside_hours_message: string | null;
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
  response_type: ResponseType;
  menu_config: Record<string, any> | null;
  is_active: boolean;
  priority: number;
  schedule: Record<string, any> | null;
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

export interface Order {
  id: string;
  instance_id: string;
  user_id: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  catalog_item_id: string | null;
  option_label: string;
  price_cents: number;
  status: "pending" | "completed" | "canceled";
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MercadoPagoConfig {
  id: string;
  user_id: string;
  access_token: string | null;
  public_key: string | null;
  webhook_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string | null;
  external_id: string;
  amount_pesos: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  plan_activated: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanConfig {
  plan_type: PlanType;
  amount_pesos: number;
  label: string;
  description: string | null;
  max_instances: number;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredGroup {
  id: string;
  instance_id: string;
  jid: string;
  group_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  instance_id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string | null;
}

export interface WebhookLog {
  id: string;
  event_type: string;
  instance_id: string | null;
  user_id: string | null;
  payload: Record<string, any> | null;
  status: ResponseLogStatus;
  error_message: string | null;
  created_at: string;
}
