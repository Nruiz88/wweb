import { NextResponse } from "next/server";
import { getUserSession } from "../auth";

/**
 * Shared admin authentication helper.
 * Returns { user, isAdmin } if the request is from an admin,
 * or a NextResponse error if not.
 *
 * All admin API routes must call requireAdmin() first.
 * Users are authenticated via the wweb_session JWT cookie (JWT_SECRET).
 * Roles are stored in the profiles table.
 *
 * Usage in any admin API route:
 *
 *   const auth = await requireAdmin();
 *   if ("error" in auth) return auth.error;
 *   const { user, isAdmin } = auth;
 */

export async function requireAdmin() {
  const session = await getUserSession();

  if (!session) {
    return { error: NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) };
  }

  if (session.role !== "admin") {
    return { error: NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }) };
  }

  return { user: { id: session.userId, email: session.email }, isAdmin: true };
}
