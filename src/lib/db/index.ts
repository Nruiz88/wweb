import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";

// La connection string se lee de la variable de entorno MARIADB_URL.
// En prod la va a proveer Coolify. En local puedes definirla en .env.
const dbUrl = process.env.MARIADB_URL;
const pool = dbUrl && dbUrl.startsWith("mysql://")
  ? mysql.createPool({
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    })
  : null as any;

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
 * Ejecuta una query parametrizada.
 * Los `?` se reemplazan por los `values` en orden.
 */
export async function query<T = any>(
  sql: string,
  values: any[] = []
): Promise<T> {
  const [rows] = await pool.execute<T>(sql, values);
  return rows as T;
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
  const whereParams: any[] = [];
  if (where) {
    sql += ` WHERE ${where}`;
    whereParams.push(...params);
  }
  const sqlParams = whereParams.concat(params);

  const totalSql = `SELECT COUNT(*) as total FROM (${sql}) AS _count`;
  const countResult = await query<{ total: number }>(totalSql, params);
  const total = countResult[0]?.total || 0;

  const offset = (page - 1) * perPage;
  sql += ` ORDER BY ${orderBy} ${order} LIMIT ${perPage} OFFSET ${offset}`;

  const data = await query<T>(sql, params);
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
