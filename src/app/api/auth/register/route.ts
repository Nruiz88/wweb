import { NextRequest, NextResponse } from "next/server";
import { generateId, query } from "@/lib/db";
import { createUser, hashPassword } from "@/lib/auth";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Sin límite se podían crear cuentas masivamente (y combined con el
  // bypass de pago de confirm-plan, Pro gratis ilimitado).
  const rateLimitErr = await rateLimitResponse(request, "auth-register", { maxRequests: 5, windowMs: 60 * 60_000 });
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { email, password, full_name } = body as { email: string; password: string; full_name?: string };
    if (!email || !password) return NextResponse.json({ status: "error", error: "email y password son obligatorios" }, { status: 400 });
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@") || trimmedEmail.length > 255) return NextResponse.json({ status: "error", error: "Email inválido" }, { status: 400 });
    const existing = await query("SELECT id FROM profiles WHERE email = ?", [trimmedEmail]);
    if (existing.length > 0) return NextResponse.json({ status: "error", error: "El email ya está registrado" }, { status: 409 });
    if (password.length < 6 || password.length > 128) return NextResponse.json({ status: "error", error: "Contraseña entre 6 y 128" }, { status: 400 });
    if (/\s/.test(password)) return NextResponse.json({ status: "error", error: "Sin espacios" }, { status: 400 });
    const id = generateId();
    await createUser(id, trimmedEmail, password, full_name || "");
    return NextResponse.json({ status: "success", message: "Usuario creado correctamente" }, { status: 201 });
  } catch (error: any) {
    console.error("[auth/register] ERROR REAL:", error?.message || error);
    return NextResponse.json({ status: "error", error: error?.message || "Error interno" }, { status: 500 });
  }
}
