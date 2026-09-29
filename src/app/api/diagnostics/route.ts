import { NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico de la capa de datos.
 *
 * Sin logs de runtime (el panel de Coolify no los tiene), esta es la forma de
 * ver si la BD responde, si el pool está inicializado y si las tablas/columnas
 * que el código usa existen de verdad. Cada check es independiente para que un
 * fallo no esconda al resto.
 */

/** Tablas y columnas que el código usa y que el schema declara. */
const EXPECTED: Record<string, string[]> = {
  instances: ["id", "admin_id", "instance_name", "evolution_api_url", "evolution_api_key", "status", "created_at", "updated_at", "welcome_message", "outside_hours_message"],
  profiles: ["id", "email", "password_hash", "full_name", "business_name", "role", "phone", "address"],
  user_instances: ["id", "user_id", "instance_id", "assigned_at"],
  auto_responses: ["id", "instance_id", "user_id", "keyword", "regex_pattern", "response_text", "response_type", "menu_config", "is_active", "priority", "schedule"],
  response_logs: ["id", "instance_id", "user_id", "incoming_phone", "incoming_message", "matched_keyword", "sent_at"],
  business_hours: ["id", "instance_id", "user_id", "day_of_week", "start_time", "end_time", "slot_duration_min", "is_active"],
  appointments: ["id", "instance_id", "user_id", "customer_phone", "customer_name", "appointment_date", "appointment_time", "duration_min", "status", "reminder_24h_sent"],
  subscriptions: ["id", "user_id", "plan_type", "status", "max_instances", "paid_until"],
  instance_addons: ["id", "user_id", "quantity", "status"],
  plan_config: ["plan_type", "amount_pesos", "label", "max_instances"],
  payments: ["id", "user_id", "external_id", "mp_payment_id", "amount_pesos", "status"],
  mercado_pago_config: ["user_id", "public_key", "access_token", "webhook_secret"],
  catalog_items: ["id", "instance_id", "label", "description", "price_cents", "active", "sort_order"],
  orders: ["id", "instance_id", "customer_phone", "customer_name", "catalog_item_id", "option_label", "price_cents", "status"],
  webhook_logs: ["id", "event_type", "instance_id", "payload", "status", "error_message", "created_at"],
};

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const env = {
    MARIADB_URL: process.env.MARIADB_URL ? "set" : "MISSING",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ? "set" : "MISSING",
    CRON_SECRET: process.env.CRON_SECRET ? "set" : "MISSING",
    JWT_SECRET: process.env.JWT_SECRET ? "set" : "MISSING",
    BUSINESS_TIMEZONE: process.env.BUSINESS_TIMEZONE ?? "(default America/Argentina/Buenos_Aires)",
    APP_URL: process.env.APP_URL ?? "MISSING",
  };

  if (!pool) {
    return NextResponse.json({
      status: "error",
      data: { env, pool: null, hint: "MARIADB_URL no definida o inválida → el pool quedó null y TODO el backend falla" },
    });
  }

  const dbOk = await query("SELECT 1 AS ok");
  const tables = (await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
  )).map((t) => t.table_name);
  const tableSet = new Set(tables);

  const columns = new Map<string, Set<string>>();
  for (const t of tables) {
    const cols = await query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
      [t]
    );
    columns.set(t, new Set(cols.map((c) => c.column_name)));
  }

  const schema: Record<string, { ok: boolean; missingTable?: boolean; missingColumns?: string[] }> = {};
  for (const [table, cols] of Object.entries(EXPECTED)) {
    if (!tableSet.has(table)) {
      schema[table] = { ok: false, missingTable: true };
      continue;
    }
    const present = columns.get(table)!;
    const missing = cols.filter((c) => !present.has(c));
    schema[table] = missing.length ? { ok: false, missingColumns: missing } : { ok: true };
  }

  const broken = Object.entries(schema).filter(([, v]) => !v.ok);

  // Muestra de los tipos reales que devuelve el driver (la causa raíz de que
  // DATE volviera como Date y rompiera el calendario). Se consulta
  // appointments (que sí tiene esas columnas), no response_logs.
  const typeSample = await query<{ appointment_date: unknown; appointment_time: unknown }>(
    "SELECT appointment_date, appointment_time FROM appointments ORDER BY created_at DESC LIMIT 1"
  );
  const typeOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  const valueOf = (v: unknown) => (v === null || v === undefined ? null : String(v).slice(0, 40));

  const webhookEvents = await query<{ n: number }>("SELECT COUNT(*) AS n FROM webhook_logs");
  const logsLast = await query<{ n: number }>("SELECT COUNT(*) AS n FROM response_logs");

  return NextResponse.json({
    status: broken.length ? "degraded" : "success",
    data: {
      env,
      pool: "ok",
      db: dbOk ? "ok" : "no responde",
      timezoneOffsetMin: new Date().getTimezoneOffset(),
      typeSample: {
        appointment_date: typeOf(typeSample?.[0]?.appointment_date),
        appointment_date_value: valueOf(typeSample?.[0]?.appointment_date),
        appointment_time: typeOf(typeSample?.[0]?.appointment_time),
        appointment_time_value: valueOf(typeSample?.[0]?.appointment_time),
        note: "esperado: string / string (pool con dateStrings). Si date es 'object', el dateStrings no aplicó",
      },
      counts: {
        tables: tables.length,
        webhook_logs: Number(webhookEvents?.[0]?.n ?? -1),
        response_logs: Number(logsLast?.[0]?.n ?? -1),
      },
      schemaOk: broken.length === 0,
      problems: broken.length
        ? broken.map(([t, v]) => ({
            table: t,
            problem: v.missingTable ? "NO EXISTE la tabla" : `faltan columnas: ${v.missingColumns?.join(", ")}`,
          }))
        : [],
    },
  });
}
