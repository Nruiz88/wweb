import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { query } from "../../../lib/db";
import { safeErrorMessage, verifyUserAccess } from "../../../lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List logs for user's instance
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  // Verify instance belongs to user
  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const [{ rows: logs }] = await query<any>(
    `SELECT *, auto_responses(keyword, regex_pattern, response_text) 
     FROM response_logs 
     WHERE instance_id = ? 
     ORDER BY sent_at DESC 
     LIMIT ? OFFSET ?`,
    [instanceId, limit, offset]
  );

  // Get total count
  const [{ rows: countRows }] = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM response_logs WHERE instance_id = ?",
    [instanceId]
  );

  return NextResponse.json({
    status: "success",
    data: {
      logs,
      total: countRows?.[0]?.count ?? 0,
      limit,
      offset,
    },
  });
}
