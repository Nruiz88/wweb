import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, paid_until, max_instances } = body as { userId?: string; paid_until?: string | null; max_instances?: number };

  if (!userId || !paid_until) {
    return NextResponse.json({ status: "error", error: "userId y paid_until requeridos" }, { status: 400 });
  }

  await query(
    "UPDATE subscriptions SET paid_until = ?, max_instances = IF(? IS NOT NULL, ?, max_instances), updated_at = NOW() WHERE user_id = ?",
    [paid_until, max_instances, max_instances, userId]
  );

  return NextResponse.json({ status: "success" });
}
