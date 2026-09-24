import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { getSession } from "../../../lib/auth/server";

// GET: Rol del usuario autenticado (ligero, sin llamadas a Evolution)
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const [{ rows: profile }] = await query<{ role: string; full_name: string | null }>(
    "SELECT role, full_name FROM profiles WHERE id = ? LIMIT 1",
    [session.userId]
  );

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
