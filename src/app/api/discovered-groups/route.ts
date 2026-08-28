import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchAllChats, fetchInstanceOwnerJid, findGroupInfos, mapLimit } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// TTL del caché: el resultado de "Buscar grupos" se guarda temporalmente en
// group_discovery_cache y expira a los pocos minutos (no se acumula).
const CACHE_TTL_MS = 5 * 60 * 1000;

// Ejecuta la búsqueda completa en Evolution (enumerar grupos + confirmar admin
// + nombre real por grupo) y devuelve la lista de grupos donde el bot es admin.
async function runDiscovery(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  instanceId: string,
  instance: { instance_name: string; evolution_api_url: string; evolution_api_key: string },
) {
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
  // Se FUSIONA con los grupos ya capturados (discovered_groups + group_settings)
  // para que la lista nunca quede incompleta si findChats devuelve parcial.
  const chatsResult = await fetchAllChats(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );
  const [discRes, confRes] = await Promise.all([
    supabase.from("discovered_groups").select("group_jid").eq("instance_id", instanceId),
    supabase.from("group_settings").select("group_jid").eq("instance_id", instanceId),
  ]);

  const jidMap = new Map<string, string>();
  if (chatsResult.ok) {
    for (const c of chatsResult.data) jidMap.set(c.remoteJid, c.name);
  }
  for (const g of [...(discRes.data || []), ...(confRes.data || [])] as Array<{ group_jid: string }>) {
    if (!jidMap.has(g.group_jid)) jidMap.set(g.group_jid, "");
  }
  const groupJids = [...jidMap.entries()].map(([jid, name]) => ({ jid, name }));

  // Confirmar admin + nombre real por grupo (findGroupInfos trae participants
  // y el phoneNumber del bot → detección admin correcta, incluso con LID).
  // Concurrencia moderada + reintento único para evitar que un timeout/429
  // transitorio deje afuera grupos que SÍ son admin (la lista era inconsistente).
  const verified = await mapLimit(groupJids, 4, async ({ jid, name }) => {
    let info = await findGroupInfos(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      jid,
      ownerJid ?? undefined,
    );
    if (!info.ok) {
      await new Promise((r) => setTimeout(r, 300));
      info = await findGroupInfos(
        instance.evolution_api_url,
        instance.evolution_api_key,
        instance.instance_name,
        jid,
        ownerJid ?? undefined,
      );
    }
    if (info.ok && info.data) {
      return { jid, name: info.data.name || name, isAdmin: info.data.isAdmin === true };
    }
    return { jid, name, isAdmin: false };
  });

  // Solo se listan grupos donde el bot es admin Y tienen nombre real
  // (resuelto en vivo o el guardado en group_settings). Nunca exponemos el JID.
  return verified
    .filter((g) => g.isAdmin && (g.name || savedMap.get(g.jid)))
    .map((g) => ({
      group_jid: g.jid,
      group_name: g.name || savedMap.get(g.jid) || null,
      saved: savedMap.has(g.jid),
    }))
    .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));
}

// GET: lee el caché temporal (sin consultar Evolution).
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

  const now = new Date().toISOString();
  const { data: cached } = await supabase
    .from("group_discovery_cache")
    .select("data")
    .eq("instance_id", instanceId)
    .gte("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ status: "success", data: cached.data, source: "cache" });
  }

  // Limpieza de entradas vencidas (temporal, no se acumulan).
  await supabase.from("group_discovery_cache").delete().eq("instance_id", instanceId);
  return NextResponse.json({ status: "success", data: [], source: "none" });
}

// POST: ejecuta "Buscar grupos" en Evolution, guarda el JSON temporal en la DB
// y lo devuelve. El resultado se consume desde el caché durante unos minutos.
export async function POST(request: Request) {
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
  const { instanceId } = (body ?? {}) as { instanceId?: string };

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

  const listed = await runDiscovery(supabase, instanceId, instance);

  // Guardar temporalmente (un solo registro por instancia) y limpiar vencidos.
  await supabase.from("group_discovery_cache").delete().eq("instance_id", instanceId);
  await supabase.from("group_discovery_cache").insert({
    instance_id: instanceId,
    data: listed,
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  });

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