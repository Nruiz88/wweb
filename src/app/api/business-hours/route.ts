import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { verifyUserAccess, safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List business hours for an instance
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const hours = await query<{ id: string; instance_id: string; user_id: string; day_of_week: number; start_time: string; end_time: string; slot_duration_min: number; is_active: boolean; created_at: string }>(
    "SELECT id, instance_id, user_id, day_of_week, start_time, end_time, slot_duration_min, is_active, created_at FROM business_hours WHERE instance_id = ? ORDER BY day_of_week ASC",
    [instanceId]
  );

  return NextResponse.json({ status: "success", data: hours });
}

// POST: Upsert business hours for an instance
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "business-hours", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, schedule } = body as { instanceId?: string; schedule?: { dayOfWeek: number; startTime: string; endTime: string; slotDurationMin?: number; isActive?: boolean }[] };

  if (!instanceId || !schedule) {
    return NextResponse.json({ status: "error", error: "instanceId and schedule are required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const results = [];
  for (const day of schedule) {
    await query(
      `INSERT INTO business_hours (id, instance_id, user_id, day_of_week, start_time, end_time, slot_duration_min, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         start_time = VALUES(start_time),
         end_time = VALUES(end_time),
         slot_duration_min = VALUES(slot_duration_min),
         is_active = VALUES(is_active),
         updated_at = NOW()`,
      [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)), instanceId, session.userId, day.dayOfWeek, day.startTime, day.endTime, day.slotDurationMin ?? 30, day.isActive ?? true]
    );
    results.push(day);
  }

  return NextResponse.json({ status: "success", data: results });
}
