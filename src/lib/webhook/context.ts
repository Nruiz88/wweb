import type { PlanType } from "@/lib/db/types";

/**
 * Minimal MariaDB query builder interface used by the webhook handlers.
 * Mirrors the Supabase client's table-query API: supabase.from(table)
 * returns a builder you chain with .select()/.insert()/.update()/.delete()/.eq()/.like()/.order()/.single()/.maybeSingle().
 */
export interface SupabaseMariaDB {
  /** Start a query on a table. */
  from<T = any>(table: string): SupabaseMariaDB;
  select<T = any>(sql: string): Promise<{ data: T[]; error?: Error }>;
  insert(data: Record<string, unknown>): Promise<{ data: any; error?: Error }>;
  update(data: Record<string, unknown>): SupabaseMariaDB;
  delete(): SupabaseMariaDB;
  eq(column: string, value: unknown): SupabaseMariaDB;
  like(column: string, pattern: string): SupabaseMariaDB;
  order(column: string, options: { ascending: boolean }): SupabaseMariaDB;
  single(): Promise<{ data: any; error?: Error }>;
  maybeSingle(): Promise<{ data: any | null; error?: Error }>;
}

/** Shared context passed to every webhook handler.
 *  Contains the instance data and plan info. supabase is a MariaDB
 *  query builder (not the Supabase client). The handler calls
 *  ctx.supabase.from(...).select(...).insert(...) etc.
 */
export interface WebhookContext {
  supabase: SupabaseMariaDB;
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
  menu_config: import("../../lib/db/types").MenuConfig | null;
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
  const hierarchy: PlanType[] = ["pending", "starter", "pro"];
  return hierarchy.indexOf(current) >= hierarchy.indexOf(minimum);
}
