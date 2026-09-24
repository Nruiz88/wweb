import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { query } from "../../../lib/db";
import { isValidUUID } from "../../../lib/validation";

export const dynamic = "force-dynamic";

// GET /api/orders?instanceId=xxx&date=YYYY-MM-DD|today
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const date = searchParams.get("date");
  if (!instanceId || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  // Verify access
  const [{ rows: inst }] = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? LIMIT 1",
    [instanceId]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const isAdmin = inst[0].admin_id === session.userId;
  if (!isAdmin) {
    const [{ rows: assigned }] = await query<{ id: string }>(
      "SELECT id FROM user_instances WHERE instance_id = ? AND user_id = ? LIMIT 1",
      [instanceId, session.userId]
    );
    if (!assigned.length) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  let sql = "SELECT * FROM orders WHERE instance_id = ? ORDER BY created_at DESC";
  const params: any[] = [instanceId];
  if (date) {
    const d = date === "today" ? new Date().toISOString().slice(0, 10) : date;
    sql += " AND created_at >= ? AND created_at <= ?";
    params.push(`${d}T00:00:00`, `${d}T23:59:59`);
  }
  sql += " LIMIT 100";
  const [{ rows: orders }] = await query<any>(sql, params);
  return NextResponse.json({ status: "success", data: orders });
}

// PATCH /api/orders { id, status }
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  if (typeof status !== "string" || !["pending", "completed", "canceled"].includes(status)) return NextResponse.json({ status: "error", error: "status invalid" }, { status: 400 });

  // Verify belongs to user
  const [{ rows: inst }] = await query<{ id: string }>(
    "SELECT id FROM orders WHERE id = ? AND instance_id IN (SELECT id FROM instances WHERE admin_id = ? UNION SELECT instance_id FROM user_instances WHERE user_id = ?)",
    [id, session.userId, session.userId]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const updates: any = { status };
  if (status === "completed") updates.completed_at = new Date().toISOString();

  const [{ insertId }] = await query(
    "UPDATE orders SET status = ?, completed_at = IF(? = 'completed', NOW(), completed_at) WHERE id = ?",
    [status, status, id]
  );

  return NextResponse.json({ status: "success", data: { id: insertId, status, completed_at: status === "completed" ? new Date().toISOString() : null } });
}
