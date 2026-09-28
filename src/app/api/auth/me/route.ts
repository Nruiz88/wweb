import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/server";

// GET: Rol del usuario autenticado (ligero, sin llamadas a Evolution)
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  // `query()` devuelve el ARRAY de filas, no un objeto. `profile?.role` daba
  // undefined siempre → la respuesta mandaba role:"user" y full_name:null a
  // todos, aunque el usuario fuera admin.
  const profiles = await query<{ role: string; full_name: string | null }>(
    "SELECT role, full_name FROM profiles WHERE id = ? LIMIT 1",
    [session.userId]
  );
  const profile = profiles?.[0];

  return NextResponse.json({
    status: "success",
    data: {
      id: session.userId,
      email: session.email,
      role: profile?.role ?? "user",
      full_name: profile?.full_name ?? null,
    },
  });
}
