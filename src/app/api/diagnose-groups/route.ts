import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchInstanceOwnerJid, findGroupInfos, mapLimit } from "@/lib/evolution-multi";
import { runGroupDiscovery } from "@/lib/group-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Diagnóstico: devuelve la respuesta CRUDA de Evolution para una instancia.
// Solo para el dueño/admin de la instancia (verifyUserAccess). No expone la
// API key al cliente: se usa server-side.
async function rawGet(baseUrl: string, apiKey: string, path: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { httpStatus: res.status, body };
  } catch (e) {
    return { httpStatus: null, error: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(t);
  }
}

// GET /api/diagnose-groups?instanceId=<id>[&groupJid=<jid>]
// instanceId opcional: si no viene, usa la primera instancia del usuario.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const groupJid = searchParams.get("groupJid");
  const searchName = searchParams.get("name");

  let instance;
  if (instanceId) {
    const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
    if (!hasAccess) {
      return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
    }
    const { data } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, owner_jid, owner_lid")
      .eq("id", instanceId)
      .single();
    instance = data;
  } else {
    // Primera instancia creada por el usuario (admin_id)
    const { data } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key, owner_jid, owner_lid")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    instance = data;
  }

  if (!instance) {
    return NextResponse.json({ status: "error", error: "No instance found" }, { status: 404 });
  }

  const base = instance.evolution_api_url;
  const key = instance.evolution_api_key;
  const name = instance.instance_name;

  const [instances, groups, connection, groupInfo] = await Promise.all([
    rawGet(base, key, `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`),
    rawGet(base, key, `/group/fetchAllGroups/${encodeURIComponent(name)}?getParticipants=false`),
    rawGet(base, key, `/instance/connectionState/${encodeURIComponent(name)}`),
    groupJid
      ? rawGet(base, key, `/group/findGroupInfos/${encodeURIComponent(name)}?groupJid=${encodeURIComponent(groupJid)}&getParticipants=true`)
      : { httpStatus: null, body: "no groupJid provided" },
  ]);

  // ============ CAPTURE: pipeline real de la app ============
  // Corre exactamente lo que hace el POST de /api/discovered-groups (persistido
  // en discovered_groups) y devuelve el resultado completo.
  let ownerJid: string | null = null;
  let adminGroups: { group_jid: string; group_name: string | null; group_picture: string | null; saved: boolean }[] = [];
  let capturedCount = 0;

  try {
    ownerJid = await fetchInstanceOwnerJid(base, key, name);
    const { count } = await supabase
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("instance_id", instance.id);
    capturedCount = count ?? 0;
    adminGroups = await runGroupDiscovery(supabase, instance.id);
  } catch (e) {
    adminGroups = [];
  }

  // ============ BÚSQUEDA POR NOMBRE ============
  // ?name=... busca en discovered_groups (DB, sin Evolution) y verifica cada
  // match con findGroupInfos (nombre, admin, imagen).
  let byName: Array<{ group_jid: string; group_name: string | null; is_admin: boolean | null; picture_url: string | null }> = [];
  if (searchName) {
    const { data: discRows } = await supabase
      .from("discovered_groups")
      .select("group_jid, group_name")
      .eq("instance_id", instance.id)
      .or(`group_name.ilike.%${searchName.trim()}%`);
    const jids = (discRows || []).map((r) => r.group_jid);
    if (jids.length > 0) {
      const results = await mapLimit(jids, 4, async (jid) => {
        const info = await findGroupInfos(base, key, name, jid, instance.owner_jid || ownerJid || undefined, instance.owner_lid || undefined);
        if (info.ok && info.data) {
          return {
            group_jid: jid,
            group_name: info.data.name || null,
            is_admin: info.data.isAdmin ?? null,
            picture_url: info.data.pictureUrl ?? null,
          };
        }
        return null;
      });
      byName = results.filter((r): r is NonNullable<typeof r> => r !== null);
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      instanceId: instance.id,
      instanceName: name,
      evolutionApiUrl: base,
      requestedGroupJid: groupJid ?? null,
      nameSearch: searchName ? { query: searchName, matches: byName } : null,
      capture: {
        ownerJid,
        groupsFound: capturedCount,
        groupsAdmin: adminGroups.length,
        adminGroups,
      },
      fetchAllGroups: groups,
      connectionState: connection,
      findGroupInfos: groupInfo,
      fetchInstances: instances,
    },
  });
}