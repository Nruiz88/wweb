import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET: Fetch instance settings
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  // Verify access
  const { data: instance } = await supabase
    .from("instances")
    .select("id, admin_id, welcome_message, outside_hours_message")
    .eq("id", instanceId)
    .single();

  if (!instance) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const isAdmin = instance.admin_id === user.id;
  if (!isAdmin) {
    const { data: assignment } = await supabase
      .from("user_instances")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("user_id", user.id)
      .single();
    if (!assignment) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      welcomeMessage: instance.welcome_message,
      outsideHoursMessage: instance.outside_hours_message,
    },
  });
}

// PUT: Update instance settings
export async function PUT(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "instance-settings", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { instanceId, welcomeMessage, outsideHoursMessage } = (body ?? {}) as {
    instanceId?: string;
    welcomeMessage?: string | null;
    outsideHoursMessage?: string | null;
  };

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  // Verify admin access
  const { data: instance } = await supabase
    .from("instances")
    .select("id, admin_id")
    .eq("id", instanceId)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Only instance admin can update settings" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (welcomeMessage !== undefined) updatePayload.welcome_message = welcomeMessage || null;
  if (outsideHoursMessage !== undefined) updatePayload.outside_hours_message = outsideHoursMessage || null;

  const { error } = await supabase
    .from("instances")
    .update(updatePayload)
    .eq("id", instanceId);

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
