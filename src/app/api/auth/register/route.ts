import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { generateId } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name } = body as {
      email: string; password: string; full_name?: string;
    };
    if (!email || !password) return NextResponse.json({ status: "error", error: "email y password son obligatorios" }, { status: 400 });
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@") || trimmedEmail.length > 255) return NextResponse.json({ status: "error", error: "Email inválido" }, { status: 400 });
    if (password.length < 6 || password.length > 128) return NextResponse.json({ status: "error", error: "Contraseña entre 6 y 128" }, { status: 400 });
    if (/\s/.test(password)) return NextResponse.json({ status: "error", error: "Sin espacios" }, { status: 400 });

    const pool = mysql.createPool({
      uri: "mysql://root:Z6kla6HsbuTZJbyP8b4m6QUAfYgaYOzHNv4yDYQcYZax1QxKmzjQg3NhLsBQitBo@w3uymvdjpzxod6zqajtdkoom:3306/default",
      connectionLimit: 1,
    });

    const [existing] = await pool.execute("SELECT id FROM profiles WHERE email = ?", [trimmedEmail]);
    if (existing.length > 0) { await pool.end(); return NextResponse.json({ status: "error", error: "Ya registrado" }, { status: 409 }); }

    const id = generateId();
    const passwordHash = await hashPassword(password);
    await pool.execute(`INSERT INTO profiles (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, 'user', NOW())`, [id, trimmedEmail, passwordHash, full_name || ""]);
    await pool.end();

    return NextResponse.json({ status: "success", message: "Usuario creado correctamente" }, { status: 201 });
  } catch (error: any) {
    console.error("[register] ERROR REAL:", error?.message || error);
    return NextResponse.json({ status: "error", error: error?.message || "Error interno" }, { status: 500 });
  }
}