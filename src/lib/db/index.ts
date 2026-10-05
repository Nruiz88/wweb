import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* =====================================================================
   Cliente de Supabase
   ---------------------------------------------------------------------
   Antes esto era un pool de mysql2 contra MariaDB. Ahora es el mismo
   Supabase que usa el panel de Nexo Studio: una sola base de datos,
   una sola sesión, una sola RLS.

   LA DIFERENCIA QUE IMPORTA
   -------------------------
   MariaDB y Postgres comparten el 90% del SQL (por eso el motor
   apenas ha cambiado). Los dos sintaxis que hay que arreglar son
   `IF(a,b,c)` → `CASE WHEN` y `NOW()` es idéntico en ambos. Los dos
   usos de `IF()` que quedaban estaban en `subscriptions` y `orders`,
   tablas que desaparecen con el sistema de planes.

   `query()` se mantiene porque hay 50 llamadas con SQL literal y
   porque un `query<T>()` que devuelve `Promise<T[]>` type-chequea
   mucho mejor que el cliente encadenado. Ver la nota de tipos más
   abajo.
   ===================================================================== */

const url = process.env.SUPABASE_URL || "";
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/* Dos clientes, no uno, y es deliberado:

   - `admin` lleva la secret key. Salta RLS. La usa el SERVIDOR: el
     webhook de Evolution (que entra sin sesión de usuario) y las
     tareas de mantenimiento.
   - `scoped` lleva la publishable key Y el token del usuario. Aplica
     RLS, o sea que si el código se equivoca al comprobar de quién es
     un bot, la base lo rechaza igual.

   Que exista `scoped` es lo que hace que un fallo de `verifyUserAccess`
   no sea un problema de datos. Con solo `admin`, todo el backend
   podría leer el bot de otro cliente y nadie se enteraría hasta que un
   cliente viera el pedido de otro. */
const admin: SupabaseClient | null = secretKey ? createClient(url, secretKey) : null;

/** Cliente que respeta RLS. Requiere el access token del cliente. */
export function getScoped(token: string): SupabaseClient {
  return createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY || "", {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

if (admin) {
  console.log(`[db] supabase → ${url}`);
} else {
  console.error("[db] falta SUPABASE_URL o SUPABASE_SECRET_KEY — no se puede leer ni escribir");
}

/* `pool` antes significaba "mysql2 está inicializado" y dos rutas lo
   usan como comprobación de salud. Ahora significa lo mismo: hay
   credenciales. Se deja el nombre para no tocar esas rutas, pero
   cualquier código que lo trate como un pool de mysql2 (`.execute()`)
   hay que cambiarlo por `admin`. */
export const pool = admin;

/**
 * El cliente de Supabase, o error si no hay credenciales.
 *
 * OJO: esto se llama DENTRO de cada función, no al importar el módulo.
 * Si se evaluara en el `const db = ...` de arriba, importar este
 * fichero sin variables de entorno (que es lo que hacen los tests, que
 * mockean las consultas) lanzaría al importar y rompería la suite
 * entera con un error de configuración de base de datos.
 *
 * Antes con MariaDB esto pasaba solo porque `pool` valía `null` y
 * `query()` reventaba al ejecutarse, no antes.
 */
export function getAdmin(): SupabaseClient {
  if (!admin) throw new Error("Supabase no está configurado (SUPABASE_URL / SUPABASE_SECRET_KEY)");
  return admin;
}

/** El cliente que hay que usar por defecto. */
export const db = admin;

/**
 * Ejecuta SQL crudo y devuelve SIEMPRE un array de filas.
 *
 * El tipo genérico es la FILA, no el array: `query<{ id: string }>(...)`
 * devuelve `Promise<{ id: string }[]>` y así `.map`, `.length` y `[0]`
 * type-chequean.
 *
 * Antes la firma era `Promise<T>`, o sea que el compilador veía UNA fila
 * donde en runtime hay un array. Eso producía ~200 errores TS en el repo
 * y hacía que `tsc` fuera inútil como gate — con el consiguiente de que
 * un error REAL pasara inadvertido entre el ruido. No volver a ignorar
 * los errores de `tsc`.
 *
 * OJO con los placeholders: MariaDB usa `?` y Postgres usa `$1`, `$2`.
 * `query` los traduce, para que las 50 llamadas existentes no cambien.
 * Dentro de un texto con `?` que NO sea un placeholder (un `LIKE '%?%'`,
 * por ejemplo) hay que usar `queryText()`, que no traduce nada.
 */
export async function query<T = any>(sql: string, values: any[] = []): Promise<T[]> {
  const c = getAdmin();
  const { data, error } = await c.rpc("ejecutar_sql", { consulta: aPlaceholders(sql), args: values });
  if (error) throw errorFromPostgres(error);
  return (data ?? []) as T[];
}

/** Como `query` pero sin traducir placeholders, para SQL con `?` dentro. */
export async function queryText<T = any>(sql: string, values: any[] = []): Promise<T[]> {
  const c = getAdmin();
  const { data, error } = await c.rpc("ejecutar_sql", { consulta: toDollar(sql), args: values });
  if (error) throw errorFromPostgres(error);
  return (data ?? []) as T[];
}

/**
 * Ejecuta INSERT / UPDATE / DELETE y devuelve las filas afectadas.
 *
 * Antes devolvía el ResultSetHeader de mysql2 (`affectedRows`,
 * `insertId`, ...). Ahora devuelve `{ affectedRows, insertId }` con los
 * MISMOS nombres para que el código que ya lo usa siga funcionando, y
 * `insertId` es null salvo que la consulta devuelva una fila con `id`.
 */
export async function exec(
  sql: string,
  values: any[] = []
): Promise<{ insertId: string | null; affectedRows: number; warningStatus: number }> {
  const filas = await query(sql, values);
  const primera = filas[0] as Record<string, unknown> | undefined;
  return {
    insertId: primera && typeof primera.id === "string" ? primera.id : null,
    affectedRows: filas.length,
    warningStatus: 0,
  };
}

/** `?` → `$1, $2, ...`. Los operadores `??` y `?|` no se tocan. */
function toDollar(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => "$" + ++i);
}

function aPlaceholders(sql: string): string {
  return toDollar(sql);
}

/**
 * Traduce los errores de Postgres a algo que un catch pueda reconocer.
 *
 * Es lo que sustituye al `ER 3819` de MariaDB. Sin esto, una violación
 * de CHECK llegaba a la UI como "Error inesperado" porque el catch
 * miraba `err.code === 'ER 3819'`.
 */
export function errorFromPostgres(e: unknown): Error {
  const err = e as { code?: string; message?: string; details?: string } | null;
  if (!err) return new Error(String(e));

  const code = err.code || "";
  const mensaje =
    code === "23505" ? "Ya existe un registro con esos datos"
    : code === "23503" ? "No se puede: hay datos que apuntan a este registro"
    : code === "23514" ? "Datos no válidos: no pasa la validación"
    : code === "23P01" ? "Ese hueco de la agenda ya está ocupado"
    : code === "42501" ? "No tienes permiso para esto"
    : err.message || "Error desconocido";

  const out = new Error(mensaje) as Error & { code?: string; original?: string };
  out.code = code;
  out.original = err.message;
  return out;
}

/* ---------------------------------------------------------------------
   ID aleatorio
   ---------------------------------------------------------------------
   MariaDB generaba los ids en la aplicación (UUID v4 con la librería),
   porque no tenía gen_random_uuid. En Postgres la columna `id` ya es
   `uuid primary key default gen_random_uuid()`: la genera la base.

   `generateId()` se conserva porque hay 18 usos y algunos construyen
   el id antes de insertar (para meterlo en un log o en un id de
   Evolution). Se sigue generando en el cliente, y la base lo acepta
   tal cual. Lo que NO se hace ya es generarlo dentro del builder.
   --------------------------------------------------------------------- */
export function generateId(): string {
  return crypto.randomUUID();
}

export type Order = "asc" | "desc";
export type NullsOrder = "first" | "last";

export interface PaginationOptions {
  page?: number;
  perPage?: number;
  orderBy?: string;
  order?: Order;
  nullsOrder?: NullsOrder;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * SELECT con paginación, ordenamiento y filtros.
 *
 * Se implementa con el cliente encadenado en vez de SQL crudo porque
 * `orderBy` viene como texto y meterlo en SQL sería inyección. El
 * cliente valida el identificador.
 */
export async function select<T = any>(
  table: string,
  {
    where,
    params,
    orderBy,
    order = "asc",
    page = 1,
    perPage = 20,
  }: {
    where?: string;
    params?: any[];
    orderBy?: string;
    order?: Order;
    page?: number;
    perPage?: number;
  } = {}
): Promise<PaginatedResult<T>> {
  /* Sin esto se generaba `ORDER BY undefined` y Postgres lo rechazaba
     con un error que no decía nada útil. */
  if (!orderBy) throw new Error(`select(${table}) requiere orderBy`);

  const desde = (Math.max(1, page) - 1) * perPage;
  const hasta = desde + perPage - 1;

  let q = getAdmin().from(table).select("*", { count: "exact" }).order(orderBy, { ascending: order === "asc" }).range(desde, hasta);

  /* `where` viene como fragmento ("status = ? AND x > ?") con `?` de
     MariaDB. Se traduce a los filtros del cliente en vez de a SQL, para
     no volver a abrir la puerta a inyección con `orderBy`. */
  if (where) aplicarWhere(q, where, params ?? []);

  const { data, count, error } = await q;
  if (error) throw errorFromPostgres(error);

  return {
    data: (data ?? []) as T[],
    total: count ?? 0,
    page: Math.max(1, page),
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

/** Traduce un `where` de estilo MariaDB a filtros encadenados. */
function aplicarWhere(q: any, where: string, params: any[]) {
  let i = 0;
  const siguiente = () => (i < params.length ? params[i++] : null);

  /* Se recorre el fragmento troceando por AND. No cubre paréntesis ni
     OR: el código que usa `select()` hoy solo tiene AND. Si algún día
     aparece un OR hay que pasarlo al cliente con `.or()`. */
  for (const parte of where.split(/\s+AND\s+/i)) {
    const m = /^\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*(=|!=|<>|<|>|<=|>=|LIKE|IN)\s*(.*?)\s*$/i.exec(parte);
    if (!m) continue;
    const [, col, op, resto] = m;

    if (op.toUpperCase() === "IN") {
      const valores = resto
        .replace(/^\((.*)\)$/, "$1")
        .split(",")
        .map((s) => (s.trim() === "?" ? siguiente() : s.trim().replace(/^'|'$/g, "")));
      q = q.in(col, valores);
    } else if (resto === "?") {
      const v = siguiente();
      q = op === "=" ? q.eq(col, v) : op === "!=" || op === "<>" ? q.neq(col, v) : q.gt(col, v);
    } else {
      const v = resto.replace(/^'|'$/g, "");
      q = op.toUpperCase() === "LIKE" ? q.like(col, v) : q.eq(col, v);
    }
  }
  return q;
}

/** INSERT single o bulk. */
export async function insert(
  table: string,
  data: Record<string, any>,
  multi = false
): Promise<{ affectedRows: number; insertId: string | null }> {
  const c = getAdmin();
  const q = multi ? c.from(table).insert(Array.isArray(data) ? data : [data]).select() : c.from(table).insert(data).select();
  const { data: filas, error } = await q;
  if (error) throw errorFromPostgres(error);
  const lista = (filas ?? []) as Record<string, string>[];
  return { affectedRows: lista.length, insertId: lista[0]?.id ?? null };
}

/** UPDATE single. */
export async function update(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<{ affectedRows: number }> {
  const { data: filas, error } = await getAdmin().from(table).update(data).eq("id", id).select();
  if (error) throw errorFromPostgres(error);
  return { affectedRows: (filas ?? []).length };
}

/** DELETE. */
export async function remove(table: string, id: string): Promise<{ affectedRows: number }> {
  const { data: filas, error } = await getAdmin().from(table).delete().eq("id", id).select();
  if (error) throw errorFromPostgres(error);
  return { affectedRows: (filas ?? []).length };
}