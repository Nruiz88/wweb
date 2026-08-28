import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchAllGroups, fetchInstanceOwnerJid } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

// GET: List WhatsApp groups where the bot is admin (live from Evolution),
// with the real group name (subject). Marks which ones are already saved.
// No longer depends on the webhook auto-capture table.
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

  const { data: instance } = await supabase
    .from("instances")
    .select("instance_name, evolution_api_url, evolution_api_key")
    .eq("id", instanceId)
    .single();
  if (!instance) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  // Groups already saved in group_settings
  const { data: saved } = await supabase
    .from("group_settings")
    .select("group_jid, group_name")
    .eq("instance_id", instanceId);
  const savedMap = new Map((saved || []).map((g) => [g.group_jid, g.group_name]));

  // Live groups where the bot is admin
  const ownerJid = await fetchInstanceOwnerJid(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );
  const result = await fetchAllGroups(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    ownerJid ?? undefined,
  );

  if (result.ok) {
    const adminGroups = result.data
      .filter((g) => g.isAdmin === true)
      .map((g) => ({
        group_jid: g.id,
        group_name: g.name || savedMap.get(g.id) || null,
        saved: savedMap.has(g.id),
      }))
      .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

    if (adminGroups.length > 0) {
      return NextResponse.json({ status: "success", data: adminGroups, source: "live" });
    }
  }

  // Fallback: webhook-captured groups (discovered_groups table) so the list is
  // never empty even when Evolution is unreachable or the bot is not admin.
  const { data: discovered } = await supabase
    .from("discovered_groups")
    .select("group_jid, group_name")
    .eq("instance_id", instanceId)
    .order("last_seen_at", { ascending: false });

  const fallback = (discovered || [])
    .map((g) => ({
      group_jid: g.group_jid,
      group_name: g.group_name || savedMap.get(g.group_jid) || null,
      saved: savedMap.has(g.group_jid),
    }))
    .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

  return NextResponse.json({ status: "success", data: fallback, source: "fallback" });
}

// DELETE: Remove a saved group config (kept for backward compat / dismissal)
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

  // Only allow deleting group_settings rows the user owns (not discovered rows,
  // since discovery is now live). Fall back to discovered_groups if present.
  const { data: group } = await supabase
    .from("group_settings")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (group) {
    const hasAccess = await verifyUserAccess(supabase, user.id, group.instance_id);
    if (!hasAccess) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
    }
    const { error } = await supabase.from("group_settings").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", error: "Failed to delete group" }, { status: 500 });
    }
    return NextResponse.json({ status: "success" });
  }

  // Legacy: discovered_groups row
  const { data: discovered } = await supabase
    .from("discovered_groups")
    .select("id, instance_id")
    .eq("id", id)
    .single();
  if (!discovered) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }
  const hasAccess = await verifyUserAccess(supabase, user.id, discovered.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }
  await supabase.from("discovered_groups").delete().eq("id", id);
  return NextResponse.json({ status: "success" });
}