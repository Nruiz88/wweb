import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { parseToken, getUserById } from "./auth";

export async function getSession(): Promise<
  | { userId: string; email: string; role: string }
  | null
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("wweb_session")?.value;
  if (!token) return null;

  const payload = parseToken(token);
  if (!payload || !payload.sub) return null;

  const user = await getUserById(payload.sub);
  if (!user) return null;

  return { userId: user.id, email: user.email, role: user.role };
}
