import type { PlanType } from "@/lib/db/types";
import { query, generateId } from "@/lib/db";

/**
 * Query builder mínimo estilo Supabase sobre mysql2 (MariaDB).
 * Implementa el subconjunto usado por los handlers del webhook:
 * from / select / insert / update / delete / eq / neq / in / like / order / limit /
 * range / single / maybeSingle. Todo con placeholders parametrizados (sin inyección).
 *
 * Cada llamada a `from()` devuelve un builder NUEVO (sin estado compartido),
 * y el builder es thenable: se puede hacer `await supabase.from(t).select(...).eq(...)`
 * igual que con el cliente de Supabase.
 */
export interface SupabaseMariaDB {
  /** Start a query on a table. Returns a fresh builder. */
  from<T = any>(table: string): SupabaseMariaDB;
  select<T = any>(columns: string): SupabaseMariaDB;
  insert(data: Record<string, unknown>): SupabaseMariaDB;
  update(data: Record<string, unknown>): SupabaseMariaDB;
  delete(): SupabaseMariaDB;
  eq(column: string, value: unknown): SupabaseMariaDB;
  neq(column: string, value: unknown): SupabaseMariaDB;
  in(column: string, values: unknown[]): SupabaseMariaDB;
  like(column: string, pattern: string): SupabaseMariaDB;
  order(column: string, options: { ascending: boolean }): SupabaseMariaDB;
  limit(n: number): SupabaseMariaDB;
  range(from: number, to: number): SupabaseMariaDB;
  single(): Promise<{ data: any; error?: Error }>;
  maybeSingle(): Promise<{ data: any | null; error?: Error }>;
}

type DbResultRow = Record<string, unknown>;

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function safeIdent(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`Identificador SQL inválido: ${name}`);
  return `\`${name}\``;
}

/** Sanitiza la lista de columnas del .select("a, b, c") — viene del código, no del usuario. */
function safeColumnList(cols: string): string {
  const parts = cols.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return "*";
  return parts.map((p) => (p === "*" ? "*" : safeIdent(p))).join(", ");
}

class MariaDbBuilder implements SupabaseMariaDB {
  constructor(private table: string) {}

  // ---- builder chain ----

  from(table: string): SupabaseMariaDB {
    return new MariaDbBuilder(table);
  }

  select(columns: string): SupabaseMariaDB {
    this.selectCols = safeColumnList(columns);
    return this;
  }
  private selectCols = "*";

  insert(data: Record<string, unknown>): SupabaseMariaDB {
    this.insertData = data;
    return this;
  }
  private insertData: Record<string, unknown> | null = null;
  private insertedId: string | null = null;

  update(data: Record<string, unknown>): SupabaseMariaDB {
    this.updateData = data;
    return this;
  }
  private updateData: Record<string, unknown> | null = null;

  delete(): SupabaseMariaDB {
    this.isDelete = true;
    return this;
  }
  private isDelete = false;

  eq(column: string, value: unknown): SupabaseMariaDB {
    this.whereClauses.push(`${safeIdent(column)} = ?`);
    this.whereParams.push(value);
    return this;
  }

  neq(column: string, value: unknown): SupabaseMariaDB {
    this.whereClauses.push(`${safeIdent(column)} != ?`);
    this.whereParams.push(value);
    return this;
  }

  in(column: string, values: unknown[]): SupabaseMariaDB {
    if (!values || values.length === 0) {
      this.whereClauses.push("1 = 0"); // .in vacío → ninguna fila (semántica Supabase)
      return this;
    }
    this.whereClauses.push(`${safeIdent(column)} IN (${values.map(() => "?").join(", ")})`);
    this.whereParams.push(...values);
    return this;
  }

  like(column: string, pattern: string): SupabaseMariaDB {
    this.whereClauses.push(`${safeIdent(column)} LIKE ?`);
    this.whereParams.push(pattern);
    return this;
  }

  order(column: string, options: { ascending: boolean }): SupabaseMariaDB {
    this.orderBy = { col: column, asc: options?.ascending !== false };
    return this;
  }
  private orderBy: { col: string; asc: boolean } | null = null;

  limit(n: number): SupabaseMariaDB {
    this.limitCount = Math.max(0, Math.floor(Number(n) || 0));
    return this;
  }
  private limitCount: number | null = null;

  range(from: number, to: number): SupabaseMariaDB {
    this.rangeFrom = Math.max(0, Math.floor(Number(from) || 0));
    this.rangeTo = Math.max(0, Math.floor(Number(to) || 0));
    return this;
  }
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;

  // ---- ejecución ----

  private async execSelect(): Promise<DbResultRow[]> {
    let sql = `SELECT ${this.selectCols} FROM ${safeIdent(this.table)}`;
    if (this.whereClauses.length) sql += " WHERE " + this.whereClauses.join(" AND ");
    if (this.orderBy) sql += ` ORDER BY ${safeIdent(this.orderBy.col)} ${this.orderBy.asc ? "ASC" : "DESC"}`;
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      sql += ` LIMIT ${this.rangeFrom}, ${this.rangeTo - this.rangeFrom + 1}`;
    } else if (this.limitCount !== null) {
      sql += ` LIMIT ${this.limitCount}`;
    }
    return query<DbResultRow[]>(sql, this.whereParams);
  }

  /** Ejecuta la operación pendiente (select/insert/update/delete). */
  private async exec(): Promise<{ data: any; error?: Error }> {
    try {
      if (!this.table) throw new Error("Query sin tabla: falta .from(table)");

      if (this.insertData) {
        const cols = Object.keys(this.insertData);
        const id = generateId();
        const allCols = [...cols, "id"];
        const allVals = [...cols.map((c) => this.insertData![c]), id];
        const sql = `INSERT INTO ${safeIdent(this.table)} (${allCols.map(safeIdent).join(", ")}) VALUES (${allCols.map(() => "?").join(", ")})`;
        await query(sql, allVals);
        this.insertedId = id;
        return { data: { id, ...this.insertData } };
      }

      if (this.updateData) {
        if (!this.whereClauses.length) throw new Error("UPDATE sin condiciones (falta .eq(...))");
        const sets = Object.keys(this.updateData).map((c) => `${safeIdent(c)} = ?`);
        const vals = Object.values(this.updateData);
        const sql = `UPDATE ${safeIdent(this.table)} SET ${sets.join(", ")} WHERE ${this.whereClauses.join(" AND ")}`;
        await query(sql, [...vals, ...this.whereParams]);
        return { data: null };
      }

      if (this.isDelete) {
        if (!this.whereClauses.length) throw new Error("DELETE sin condiciones (falta .eq(...))");
        const sql = `DELETE FROM ${safeIdent(this.table)} WHERE ${this.whereClauses.join(" AND ")}`;
        await query(sql, this.whereParams);
        return { data: null };
      }

      const rows = await this.execSelect();
      return { data: rows };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }

  /** Hace el builder thenable: `await builder` ejecuta la operación pendiente. */
  then<TResult1 = { data: any; error?: Error }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error?: Error }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  single(): Promise<{ data: any; error?: Error }> {
    return this.exec().then((r) => {
      if (r.error) return { data: null, error: r.error };
      if (Array.isArray(r.data)) {
        if (r.data.length === 0) return { data: null, error: new Error("Row not found") };
        return { data: r.data[0] };
      }
      return { data: r.data };
    });
  }

  maybeSingle(): Promise<{ data: any | null; error?: Error }> {
    return this.exec().then((r) => {
      if (r.error) return { data: null, error: r.error };
      if (Array.isArray(r.data)) return { data: r.data[0] ?? null };
      return { data: r.data ?? null };
    });
  }
}

/** Crea el adaptador compartido del contexto del webhook. Stateless: cada .from() devuelve un builder nuevo. */
export function createSupabaseMariaDB(): SupabaseMariaDB {
  return new MariaDbBuilder("");
}

const PLAN_HIERARCHY: Record<string, number> = { starter: 1, pro: 2 };

/** True si el plan actual alcanza el plan requerido (starter < pro). */
export function hasPlan(current: PlanType, required: PlanType): boolean {
  return (PLAN_HIERARCHY[current] ?? 0) >= (PLAN_HIERARCHY[required] ?? 0);
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
