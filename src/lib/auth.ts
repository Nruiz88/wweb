import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { pool } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "wweb-secret-dev-change-me";
const COOKIE_NAME = "wweb_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export type AuthError =
  | { status: 400; message: string }        // credenciales inválidas
  | { status: 401; message: string };        // usuario no encontrado

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function parseToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<
  | { id: string; email: string; password_hash: string; full_name: string; role: string }
  | null
> {
  const rows = await query(
    "SELECT id, email, password_hash, full_name, role FROM profiles WHERE email = ?",
    [email]
  );
  return rows[0] || null;
}

export async function getUserById(id: string): Promise<
  | { id: string; email: string; password_hash: string; full_name: string; role: string }
  | null
> {
  const rows = await query(
    "SELECT id, email, password_hash, full_name, role FROM profiles WHERE id = ?",
    [id]
  );
  return rows[0] || null;
}

export async function createUser(
  id: string,
  email: string,
  password: string,
  full_name: string
): Promise<{ id: string; email: string; full_name: string; role: string }> {
  const passwordHash = await hashPassword(password);
  const [result] = await pool.execute(
    `INSERT INTO profiles (id, email, password_hash, full_name, role, created_at)
     VALUES (?, ?, ?, ?, 'user', NOW())`,
    [id, email, passwordHash, full_name]
  );
  return {
    id: result.insertId,
    email,
    full_name,
    role: "user",
  };
}

export async function setUserRole(
  userId: string,
  role: "admin" | "user"
): Promise<void> {
  await pool.execute(
    "UPDATE profiles SET role = ? WHERE id = ?",
    [role, userId]
  );
}

export async function getUserSession(): Promise<
  | { userId: string; email: string; role: string }
  | null
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = parseToken(token);
  if (!payload || !payload.sub) return null;

  const user = await getUserById(payload.sub);
  if (!user) return null;

  return { userId: user.id, email: user.email, role: user.role };
}

export async function getSession(): Promise<
  | { userId: string; email: string; role: string }
  | null
> {
  return getUserSession();
}


export async function login(email: string, password: string): Promise<{ status: number; message: string; token?: string }> {
  const user = await getUserByEmail(email);
  if (!user) {
    return { status: 401, message: "Usuario o contraseña inválidos" };
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { status: 401, message: "Usuario o contraseña inválidos" };
  }
  const token = signToken(user.id);
  return { status: 200, message: "OK", token };
}
