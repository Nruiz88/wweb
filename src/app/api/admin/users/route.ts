import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { safeErrorMessage } from "@/lib/api-helpers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: List all users (admin only)
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const users = await query<{ id: string; email: string; full_name: string; role: string; created_at: string }>(
    "SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC"
  );

  if (users.length) {
    return NextResponse.json({ status: "success", data: users });
  }
  return NextResponse.json({ status: "success", data: [] });
}
