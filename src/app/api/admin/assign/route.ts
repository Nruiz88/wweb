import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-helpers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  const inst = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? AND admin_id = ? LIMIT 1",
    [instanceId, auth.user.id]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const assignments = await query<{ id: string; user_id: string; assigned_at: string; email: string; full_name: string }>(
    `SELECT ui.id, ui.user_id, ui.assigned_at, p.email, p.full_name
     FROM user_instances ui
     JOIN profiles p ON ui.user_id = p.id
     WHERE ui.instance_id = ?`,
    [instanceId]
  );

  if (assignments.length) {
    return NextResponse.json({ status: "success", data: assignments });
  }
  return NextResponse.json({ status: "success", data: [] });
}

export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, userEmail } = body as { instanceId?: string; userEmail?: string };
  if (!instanceId || !userEmail) {
    return NextResponse.json({ status: "error", error: "instanceId and userEmail required" }, { status: 400 });
  }

  const inst = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? AND admin_id = ? LIMIT 1",
    [instanceId, auth.user.id]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });

  const targetUser = await query<{ id: string }>(
    "SELECT id FROM profiles WHERE email = ? LIMIT 1",
    [userEmail]
  );
  if (!targetUser.length) {
    return NextResponse.json({ status: "error", error: "User not found with that email" }, { status: 404 });
  }

  const existing = await query<{ id: string }>(
    "SELECT id FROM user_instances WHERE user_id = ? AND instance_id = ? LIMIT 1",
    [targetUser[0].id, instanceId]
  );
  if (existing.length) {
    return NextResponse.json({ status: "error", error: "User already assigned" }, { status: 409 });
  }

  const { insertId } = await query(
    "INSERT INTO user_instances (id, user_id, instance_id, assigned_at) VALUES (?, ?, ?, NOW())",
    [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)), targetUser[0].id, instanceId]
  );

  return NextResponse.json({ status: "success", data: { id: insertId, user_id: targetUser[0].id, instance_id: instanceId } });
}

export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("id");
  if (!assignmentId) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });

  const assignment = await query<{ id: string; instance_id: string }>(
    "SELECT id, instance_id FROM user_instances WHERE id = ? LIMIT 1",
    [assignmentId]
  );
  if (!assignment.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const inst = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? AND admin_id = ? LIMIT 1",
    [assignment[0].instance_id, auth.user.id]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });

  await query("DELETE FROM user_instances WHERE id = ?", [assignmentId]);
  return NextResponse.json({ status: "success" });
}
