import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchAllChats, fetchInstanceOwnerJid, findGroupInfos } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // Live groups where the bot is admin.
  const ownerJid = await fetchInstanceOwnerJid(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );

  // Enumerar grupos por findChats (lee la DB local, rápido). fetchAllGroups
  // tarda 25s+ y aborta incluso sin participants (issue EvolutionAPI#1883).
  // Fallback: grupos ya capturados (discovered_groups + group_settings).
  const chatsResult = await fetchAllChats(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );

  let groupJids: { jid: string; name: string }[] = [];
  if (chatsResult.ok && chatsResult.data.length > 0) {
    groupJids = chatsResult.data.map((c) => ({ jid: c.remoteJid, name: c.name }));
  } else {
    const [discRes, confRes] = await Promise.all([
      supabase.from("discovered_groups").select("group_jid").eq("instance_id", instanceId),
      supabase.from("group_settings").select("group_jid").eq("instance_id", instanceId),
    ]);
    const jids = new Set<string>([
      ...(discRes.data || []).map((g: { group_jid: string }) => g.group_jid),
      ...(confRes.data || []).map((g: { group_jid: string }) => g.group_jid),
    ]);
    groupJids = [...jids].map((jid) => ({ jid, name: "" }));
  }

  // Confirmar admin + nombre real por grupo (findGroupInfos trae participants
  // y el phoneNumber del bot → detección admin correcta, incluso con LID).
  const verified = await Promise.all(
    groupJids.map(async ({ jid, name }) => {
      const info = await findGroupInfos(
        instance.evolution_api_url,
        instance.evolution_api_key,
        instance.instance_name,
        jid,
        ownerJid ?? undefined,
      );
      if (info.ok && info.data) {
        return { jid, name: info.data.name || name, isAdmin: info.data.isAdmin === true };
      }
      return { jid, name, isAdmin: false };
    }),
  );

  // Solo se listan grupos donde el bot es admin Y tienen nombre real
  // (resuelto en vivo o el guardado en group_settings). Nunca exponemos el JID.
  const listed = verified
    .filter((g) => g.isAdmin && (g.name || savedMap.get(g.jid)))
    .map((g) => ({
      group_jid: g.jid,
      group_name: g.name || savedMap.get(g.jid) || null,
      saved: savedMap.has(g.jid),
    }))
    .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

  return NextResponse.json({ status: "success", data: listed, source: "live" });
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