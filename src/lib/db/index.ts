import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";

// La connection string se lee de la variable de entorno MARIADB_URL.
// En prod la provee Coolify. Se parsea manualmente para no depender del
// parser de `uri` de mysql2 (no fiable dentro del bundle de Turbopack).
function parseDbUrl(url: string) {
  try {
    const u = new URL(url.trim());
    const database = u.pathname.replace(/^\//, "") || "default";
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database,
    };
  } catch {
    return null;
  }
}

const dbUrl = process.env.MARIADB_URL || process.env.DATABASE_URL || "";
const parsed = dbUrl ? parseDbUrl(dbUrl) : null;

const pool = parsed
  ? mysql.createPool({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      waitForConnections: true,
      connectionLimit: 10,
      // Sin esto mysql2 devuelve DATE/DATETIME/TIMESTAMP como objetos Date y TIME
      // como "HH:MM:SS". Todo el código los trata como strings "YYYY-MM-DD" /
      // "HH:MM", así que:
      //   - `new Date(appt.appointment_date + "T12:00:00")` → Invalid Date
      //     (encabezado "undefined NaN" en /calendar, badge HOY nunca activa)
      //   - `${row.appointment_date}|${row.appointment_time}` nunca matchea
      //     contra "2026-09-28|09:00" → los slots OCUPADOS se ofrecen como
      //     libres en /agendar y en el bot.
      dateStrings: ["DATE", "DATETIME", "TIMESTAMP"],
    })
  : null as any;

if (parsed) {
  console.log(`[db] pool → host=${parsed.host} db=${parsed.database} user=${parsed.user}`);
} else {
  console.error("[db] MARIADB_URL no definida o inválida — pool no inicializado");
}

export { pool };

// Tipo para los resultados de las queries
export type DbResult =
  | { affectedRows: number; insertId: number }
  | { fieldCount: number; affectedRows: number; insertId: number; info: any; serverStatus: number; warningStatus: number; message: string; protocol41: true; fields: any[]; rows: any[]; rowsAffected: number | { select?: number; update?: number; delete?: number; sales?: number; put?: number; replace?: number; set?: number; insert?: number; connect?: number } };

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
 * Ejecuta una consulta y devuelve SIEMPRE un array de filas.
 *
 * El tipo genérico es la FILA, no el array: `query<{ id: string }>(...)` devuelve
 * `Promise<{ id: string }[]>` y así `.map`, `.length` y `[0]` type-chequean.
 *
 * Antes la firma era `Promise<T>`, o sea que el compilador veía UNA fila
 * donde en runtime hay un array. Eso producía ~200 errores TS en el repo y
 * hacía que `tsc` fuera inútil como gate — con el后果ario de que un error
 * REAL (MariaDbBuilder usando whereClauses sin declarar) pasara inadvertido
 * entre el ruido. No volver a ignorar los errores de `tsc`.
 */
export async function query<T = any>(
  sql: string,
  values: any[] = []
): Promise<T[]> {
  // `pool` es `any` cuando MARIADB_URL falta (ternario con `null as any`), así
  // que no se le pueden pasar type args: se castea el resultado.
  const [rows] = await pool.execute(sql, values);
  return rows as T[];
}

/**
 * Ejecuta INSERT / UPDATE / DELETE y devuelve el ResultSetHeader
 * (`insertId`, `affectedRows`, ...).
 *
 * OJO: las PK de este proyecto son VARCHAR generadas por la app, sin
 * AUTO_INCREMENT, así que `insertId` SIEMPRE da 0. Para inserts generá el id
 * con `generateId()` y devuelvelo vos.
 */
export async function exec(
  sql: string,
  values: any[] = []
): Promise<{ insertId: number; affectedRows: number; warningStatus: number }> {
  const [res] = await pool.execute(sql, values);
  return res as { insertId: number; affectedRows: number; warningStatus: number };
}

/**
 * SELECT con paginación, ordenamiento y filtros.
 */
export async function select<T = any>(
  table: string,
  {
    where,
    params,
    orderBy,
    order = "asc",
    nullsOrder,
    page = 1,
    perPage = 20,
  }: {
    where?: string;
    params?: any[];
    orderBy?: string;
    order?: Order;
    nullsOrder?: NullsOrder;
    page?: number;
    perPage?: number;
  } = {}
): Promise<PaginatedResult<T>> {
  let sql = `SELECT * FROM ${table}`;
  // Antes: `whereParams.push(...params)` reventaba si `where` venía sin
  // `params`, los params se contaban dos veces (`whereParams.concat(params)`
  // que además no se usaba nunca) y `ORDER BY ${orderBy}` con orderBy
  // undefined generaba SQL inválido. Ahora se valida y se usa una sola lista.
  const sqlParams: any[] = [];
  if (where) {
    sql += ` WHERE ${where}`;
    sqlParams.push(...(params ?? []));
  }
  if (!orderBy) {
    throw new Error(`select(${table}) requiere orderBy`);
  }

  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM (${sql}) AS _count`,
    sqlParams
  );
  const total = countResult[0]?.total || 0;

  const offset = (page - 1) * perPage;
  const data = await query<T>(`${sql} ORDER BY ${orderBy} ${order} LIMIT ${perPage} OFFSET ${offset}`, sqlParams);

  return {
    data,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * INSERT single o bulk.
 */
export async function insert(
  table: string,
  data: Record<string, any>,
  multi = false
): Promise<DbResult> {
  const keys = Object.keys(data);
  const values = keys.map(() => "?");
  const sql = multi
    ? `INSERT INTO ${table} (${keys.join(", ")}) VALUES ${data.map(() => `(${values.join(", ")})`).join(", ")}`
    : `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${values.join(", ")})`;
  return pool.execute(sql, Object.values(data));
}

/**
 * UPDATE single.
 */
export async function update(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<DbResult> {
  const setClauses = Object.keys(data).map((k) => `${k} = ?`);
  const sql = `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`;
  return pool.execute(sql, [...Object.values(data), id]);
}

/**
 * DELETE.
 */
export async function remove(table: string, id: string): Promise<DbResult> {
  const sql = `DELETE FROM ${table} WHERE id = ?`;
  return pool.execute(sql, [id]);
}

/**
 * ID aleatorio UUID v4 para MySQL (no soporta gen_random_uuid en toda la vida).
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Helper para obtener la conexión actual (para transacciones).
 */
export async function getConnection(): Promise<mysql.Connection> {
  return pool.getConnection();
}
