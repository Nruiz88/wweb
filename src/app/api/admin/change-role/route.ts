import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// PATCH: Change a user's role (admin only)
export async function PATCH(request: Request) {
  const rlResponse = await rateLimitResponse(request, "admin/change-role", { maxRequests: 20 });
  if (rlResponse) return rlResponse;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, role } = (body ?? {}) as { userId?: string; role?: string };

  if (!userId || !role) {
    return NextResponse.json({ status: "error", error: "userId and role required" }, { status: 400 });
  }

  if (!["admin", "user"].includes(role)) {
    return NextResponse.json({ status: "error", error: "Invalid role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: { userId, role } });
}
