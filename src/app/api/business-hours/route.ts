import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { verifyUserAccess, safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List business hours for an instance
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

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: hours, error } = await supabase
    .from("business_hours")
    .select("*")
    .eq("instance_id", instanceId)
    .order("day_of_week", { ascending: true });

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: hours });
}

// POST: Upsert business hours for an instance
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "business-hours", { maxRequests: 20, windowMs: 60_000 });
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

  const { instanceId, schedule } = (body ?? {}) as {
    instanceId?: string;
    schedule?: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotDurationMin?: number;
      isActive?: boolean;
    }[];
  };

  if (!instanceId || !schedule) {
    return NextResponse.json({ status: "error", error: "instanceId and schedule are required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Upsert each day
  const results = [];
  for (const day of schedule) {
    const { data, error } = await supabase
      .from("business_hours")
      .upsert(
        {
          instance_id: instanceId,
          user_id: user.id,
          day_of_week: day.dayOfWeek,
          start_time: day.startTime,
          end_time: day.endTime,
          slot_duration_min: day.slotDurationMin ?? 30,
          is_active: day.isActive ?? true,
        },
        { onConflict: "instance_id,day_of_week" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
    }
    results.push(data);
  }

  return NextResponse.json({ status: "success", data: results });
}
