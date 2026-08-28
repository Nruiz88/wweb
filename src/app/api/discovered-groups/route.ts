import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List discovered groups for an instance (groups not yet configured)
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

  // Get groups that are discovered but NOT yet configured in group_settings
  const { data: configuredJids } = await supabase
    .from("group_settings")
    .select("group_jid")
    .eq("instance_id", instanceId);

  const configuredSet = new Set((configuredJids || []).map((g) => g.group_jid));

  const { data: discovered, error } = await supabase
    .from("discovered_groups")
    .select("*")
    .eq("instance_id", instanceId)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: "Failed to fetch discovered groups" }, { status: 500 });
  }

  // Filter out already configured groups
  const unconfigured = (discovered || []).filter((g) => !configuredSet.has(g.group_jid));

  return NextResponse.json({ status: "success", data: unconfigured });
}

// DELETE: Dismiss a discovered group (user doesn't want to configure it)
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  // Verify the discovered group belongs to an instance the user can access
  const { data: group } = await supabase
    .from("discovered_groups")
    .select("instance_id")
    .eq("id", id)
    .single();

  if (!group) {
    return NextResponse.json({ status: "error", error: "Group not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, group.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("discovered_groups")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ status: "error", error: "Failed to dismiss group" }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
