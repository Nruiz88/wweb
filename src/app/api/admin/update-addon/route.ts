import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, quantity } = body as { userId?: string; quantity?: number };
  if (!userId || quantity == null || quantity < 0) {
    return NextResponse.json({ status: "error", error: "userId y quantity requeridos" }, { status: 400 });
  }

  const id = String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15));
  await query(
    `INSERT INTO instance_addons (id, user_id, quantity, status, created_at, updated_at)
     VALUES (?, ?, ?, 'active', NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       quantity = VALUES(quantity),
       status = VALUES(status),
       updated_at = NOW()`,
    [id, userId, quantity]
  );

  return NextResponse.json({ status: "success" });
}
