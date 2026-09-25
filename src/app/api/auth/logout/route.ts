import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";

// POST /api/auth/logout — borra la cookie de sesión.
// La UI llama este endpoint desde lib/auth/client.ts y el layout del dashboard.
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ status: "success" });
}
