import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanType } from "@/lib/supabase/types";

/**
 * Shared context passed to every webhook handler.
 * Contains the instance data, supabase client, and plan info.
 */
export interface WebhookContext {
  supabase: SupabaseClient;
  instance: {
    id: string;
    instance_name: string;
    evolution_api_url: string;
    evolution_api_key: string;
    welcome_message: string | null;
    outside_hours_message: string | null;
  };
  plan: PlanType;
  instanceName: string;
  remoteJid: string;
  phoneNumber: string;
  effectiveText: string;
  buttonText: string;
  listText: string;
  pushName?: string;
  messageId?: string;
  senderJid?: string;
  /** Raw selectedButtonId when the message is a button tap. */
  rawButtonId?: string;
  /** Pre-fetched auto-responses for this instance (loaded once, shared) */
  autoResponses?: AutoResponseRow[];
}

export interface AutoResponseRow {
  id: string;
  keyword: string | null;
  regex_pattern: string | null;
  response_type: string;
  menu_config: import("@/lib/supabase/types").MenuConfig | null;
  response_text: string;
  response_media_url: string | null;
  priority: number;
  schedule: { from?: string; to?: string } | null;
  user_id: string;
}

/** Result from a webhook handler */
export interface HandlerResult {
  status: string;
  matched?: string;
  error?: string;
}

/** Helper to check if plan meets minimum requirement */
export function hasPlan(current: PlanType, minimum: PlanType): boolean {
  const hierarchy: PlanType[] = ["starter", "pro", "community"];
  return hierarchy.indexOf(current) >= hierarchy.indexOf(minimum);
}
