import { NextRequest, NextResponse } from "next/server";
import { generateId, query } from "@/lib/db";
import { createUser, hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name } = body as {
      email: string;
      password: string;
      full_name?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { status: "error", error: "email y password son obligatorios" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail.includes("@") || trimmedEmail.length > 255) {
      return NextResponse.json(
        { status: "error", error: "Email inválido" },
        { status: 400 }
      );
    }

    // Email ya registrado?
    const [existing] = await query(
      "SELECT id FROM profiles WHERE email = ?",
      [trimmedEmail]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { status: "error", error: "El email ya está registrado" },
        { status: 409 }
      );
    }

    if (password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { status: "error", error: "La contraseña debe tener entre 6 y 128 caracteres" },
        { status: 400 }
      );
    }
    if (/\s/.test(password)) {
      return NextResponse.json(
        { status: "error", error: "La contraseña no debe contener espacios" },
        { status: 400 }
      );
    }

    const id = generateId();
    await createUser(id, trimmedEmail, password, full_name || "");

    return NextResponse.json(
      { status: "success", message: "Usuario creado correctamente" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[auth/register] ERROR DETALLADO:", error?.message || error);
    console.error("[auth/register] MARIADB_URL:", process.env.MARIADB_URL ? "definida" : "NO DEFINIDA");
    console.error("[auth/register] DATABASE_URL:", process.env.DATABASE_URL ? "definida" : "NO DEFINIDA");
    console.error("[auth/register] pool:", require("./db/index").pool ? "ok" : "null");
    return NextResponse.json(
      { status: "error", error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
