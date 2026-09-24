import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body as { email: string; token?: string };

    if (!email) {
      return NextResponse.json(
        { status: "error", error: "email es obligatorio" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    const [rows] = await db.query(
      "SELECT id FROM profiles WHERE email = ?",
      [trimmedEmail]
    );

    if (rows.length === 0) {
      // No revelamos si el email existe (OWASP)
      return NextResponse.json(
        { status: "success", message: "Si el email está registrado, enviamos instrucciones" },
        { status: 200 }
      );
    }

    // En un entorno real se enviaría un email con un link
    // /reset-password/confirm?token=<jwt-or-hash>.
    // Por ahora respondemos OK.
    return NextResponse.json(
      { status: "success", message: "Si el email está registrado, enviamos instrucciones" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[reset-password]", error);
    return NextResponse.json(
      { status: "error", error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
