import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: List logs for user's instance
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  if (!instanceId) {
    return NextResponse.json(
      { status: "error", error: "instanceId is required" },
      { status: 400 }
    );
  }

  // Verify instance belongs to user
  const { data: instance } = await supabase
    .from("instances")
    .select("id")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .single();

  if (!instance) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: logs, error } = await supabase
    .from("response_logs")
    .select("*, auto_responses(keyword, regex_pattern, response_text)")
    .eq("instance_id", instanceId)
    .order("sent_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  // Get total count
  const { count } = await supabase
    .from("response_logs")
    .select("*", { count: "exact", head: true })
    .eq("instance_id", instanceId);

  return NextResponse.json({
    status: "success",
    data: {
      logs,
      total: count ?? 0,
      limit,
      offset,
    },
  });
}
