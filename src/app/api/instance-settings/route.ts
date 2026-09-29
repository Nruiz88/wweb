import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: Fetch instance settings
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

  // Verify access
  const inst = await query<{ id: string; admin_id: string; welcome_message: string | null; outside_hours_message: string | null }>(
    "SELECT id, admin_id, welcome_message, outside_hours_message FROM instances WHERE id = ? LIMIT 1",
    [instanceId]
  );
  if (!inst.length) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }
  const isAdmin = inst[0].admin_id === session.userId;
  if (!isAdmin) {
    const assigned = await query<{ id: string }>(
      "SELECT id FROM user_instances WHERE instance_id = ? AND user_id = ? LIMIT 1",
      [instanceId, session.userId]
    );
    if (!assigned.length) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      welcomeMessage: inst[0].welcome_message,
      outsideHoursMessage: inst[0].outside_hours_message,
    },
  });
}

// PUT: Update instance settings
export async function PUT(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "instance-settings", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, welcomeMessage, outsideHoursMessage } = body as { instanceId?: string; welcomeMessage?: string | null; outsideHoursMessage?: string | null };
  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  // Verify admin access
  const inst = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? LIMIT 1",
    [instanceId]
  );
  if (!inst.length || inst[0].admin_id !== session.userId) {
    return NextResponse.json({ status: "error", error: "Only instance admin can update settings" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (welcomeMessage !== undefined) updatePayload.welcome_message = welcomeMessage || null;
  if (outsideHoursMessage !== undefined) updatePayload.outside_hours_message = outsideHoursMessage || null;

  await query(
    "UPDATE instances SET welcome_message = ?, outside_hours_message = ? WHERE id = ?",
    [updatePayload.welcome_message, updatePayload.outside_hours_message, instanceId]
  );

  return NextResponse.json({ status: "success" });
}
