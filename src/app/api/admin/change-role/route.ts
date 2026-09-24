import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { rateLimitResponse } from "../../../lib/rate-limit";
import { isValidUUID } from "../../../lib/validation";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const rlResponse = await rateLimitResponse(request, "admin/change-role", { maxRequests: 20 });
  if (rlResponse) return rlResponse;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, role } = body as { userId?: string; role?: string };

  if (!userId || !role) {
    return NextResponse.json({ status: "error", error: "userId and role required" }, { status: 400 });
  }
  if (!["admin", "user"].includes(role)) {
    return NextResponse.json({ status: "error", error: "Invalid role" }, { status: 400 });
  }
  if (!isValidUUID(userId)) {
    return NextResponse.json({ status: "error", error: "Invalid user ID" }, { status: 400 });
  }

  await query("UPDATE profiles SET role = ? WHERE id = ?", [role, userId]);

  return NextResponse.json({ status: "success", data: { userId, role } });
}
