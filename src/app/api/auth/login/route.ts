import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUserByEmail, verifyPassword, signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ status: "error", error: "email y password son obligatorios" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const user = await getUserByEmail(email.trim().toLowerCase());

    if (!user || !user.password_hash) {
      return new Response(
        JSON.stringify({ status: "error", error: "Usuario o contraseña inválidos" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return new Response(
        JSON.stringify({ status: "error", error: "Usuario o contraseña inválidos" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const token = signToken(user.id);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return new Response(
      JSON.stringify({ status: "success", user: { id: user.id, email: user.email } }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[login]", error);
    return new Response(
      JSON.stringify({ status: "error", error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}