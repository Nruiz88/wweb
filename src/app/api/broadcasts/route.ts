import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { sendGroupMessage } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

// GET: List broadcasts for an instance
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

  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: broadcasts });
}

// POST: Create a broadcast
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "broadcasts", { maxRequests: 10, windowMs: 60_000 });
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

  const { instanceId, title, message, groupJids, sendNow } = (body ?? {}) as {
    instanceId?: string;
    title?: string;
    message?: string;
    groupJids?: string[];
    sendNow?: boolean;
  };

  if (!instanceId || !title || !message || !groupJids || groupJids.length === 0) {
    return NextResponse.json(
      { status: "error", error: "instanceId, title, message, and groupJids are required" },
      { status: 400 },
    );
  }

  // Verify admin access
  const { data: instance } = await supabase
    .from("instances")
    .select("id, admin_id, instance_name, evolution_api_url, evolution_api_key")
    .eq("id", instanceId)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Only instance admin can create broadcasts" }, { status: 403 });
  }

  // Create broadcast record
  const { data: broadcast, error: broadcastError } = await supabase
    .from("broadcasts")
    .insert({
      instance_id: instanceId,
      user_id: user.id,
      title,
      message,
      status: sendNow ? "sending" : "draft",
      total_groups: groupJids.length,
    })
    .select()
    .single();

  if (broadcastError) {
    return NextResponse.json({ status: "error", error: broadcastError.message }, { status: 500 });
  }

  // Create recipients
  const recipients = groupJids.map((jid) => ({
    broadcast_id: broadcast.id,
    group_jid: jid,
    status: "pending" as const,
  }));

  await supabase.from("broadcast_recipients").insert(recipients);

  // If sendNow, send immediately
  if (sendNow) {
    let sentCount = 0;
    let failedCount = 0;

    // Get group names from group_settings if available
    const { data: groupNames } = await supabase
      .from("group_settings")
      .select("group_jid, group_name")
      .eq("instance_id", instanceId)
      .in("group_jid", groupJids);

    const nameMap = new Map((groupNames || []).map((g) => [g.group_jid, g.group_name]));

    for (const jid of groupJids) {
      try {
        const result = await sendGroupMessage(
          instance.evolution_api_url,
          instance.evolution_api_key,
          instance.instance_name,
          jid,
          message,
          undefined,
          2000,
        );

        if (result.ok) {
          sentCount++;
          await supabase
            .from("broadcast_recipients")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("broadcast_id", broadcast.id)
            .eq("group_jid", jid);
        } else {
          failedCount++;
          await supabase
            .from("broadcast_recipients")
            .update({ status: "failed", error: result.message })
            .eq("broadcast_id", broadcast.id)
            .eq("group_jid", jid);
        }
      } catch {
        failedCount++;
        await supabase
          .from("broadcast_recipients")
          .update({ status: "failed", error: "Network error" })
          .eq("broadcast_id", broadcast.id)
          .eq("group_jid", jid);
      }
    }

    // Update broadcast status
    await supabase
      .from("broadcasts")
      .update({
        status: failedCount === groupJids.length ? "failed" : "completed",
        sent_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq("id", broadcast.id);

    return NextResponse.json({
      status: "success",
      data: { ...broadcast, sent_count: sentCount, failed_count: failedCount },
    });
  }

  return NextResponse.json({ status: "success", data: broadcast });
}

// PATCH: Update broadcast status (e.g., cancel draft)
export async function PATCH(request: Request) {
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

  const { id, status } = (body ?? {}) as { id?: string; status?: string };

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("broadcasts")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  const { data: instance } = await supabase
    .from("instances")
    .select("admin_id")
    .eq("id", existing.instance_id)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase.from("broadcasts").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
