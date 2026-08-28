import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchAllChats, fetchInstanceOwnerJid, findGroupInfos, mapLimit } from "@/lib/evolution-multi";
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

async function rawFetchPost(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { httpStatus: res.status, body: parsed };
  } catch (e) {
    return { httpStatus: null, error: e instanceof Error ? e.message : "network error" };
  } finally {
    clearTimeout(t);
  }
}

type RawResult = { httpStatus: number | null; body?: unknown; error?: string };

// Resumen compacto de un findChats: cuántos chats trae, cuántos son grupos y
// sus JIDs. Evita tener que pegar el JSON gigante completo.
function summarizeChats(resp: RawResult) {
  if (resp.httpStatus === null) {
    return { httpStatus: null, error: resp.error ?? "network error", chats: 0, groups: 0, groupJids: [] };
  }
  let list: unknown[] = [];
  const body = resp.body;
  if (Array.isArray(body)) {
    list = body;
  } else if (body && typeof body === "object" && Array.isArray((body as { chats?: unknown[] }).chats)) {
    list = (body as { chats: unknown[] }).chats;
  }
  const groupJids = list
    .map((c) => String((c as { remoteJid?: unknown; jid?: unknown }).remoteJid ?? (c as { jid?: unknown }).jid ?? ""))
    .filter((j) => j.includes("@g.us"));
  return { httpStatus: resp.httpStatus, chats: list.length, groups: groupJids.length, groupJids };
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

  const [instances, groups, chatWhere, chatTakeSkip, chatLimitOffset, chatAll, connection, groupInfo] = await Promise.all([
    rawGet(base, key, `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`),
    rawGet(base, key, `/group/fetchAllGroups/${encodeURIComponent(name)}?getParticipants=false`),
    rawFetchPost(base, key, `/chat/findChats/${encodeURIComponent(name)}`, { where: { isGroup: true } }),
    rawFetchPost(base, key, `/chat/findChats/${encodeURIComponent(name)}`, { take: 500, skip: 0 }),
    rawFetchPost(base, key, `/chat/findChats/${encodeURIComponent(name)}`, { limit: 500, offset: 0 }),
    rawFetchPost(base, key, `/chat/findChats/${encodeURIComponent(name)}`, {}),
    rawGet(base, key, `/instance/connectionState/${encodeURIComponent(name)}`),
    groupJid
      ? rawGet(base, key, `/group/findGroupInfos/${encodeURIComponent(name)}?groupJid=${encodeURIComponent(groupJid)}&getParticipants=true`)
      : { httpStatus: null, body: "no groupJid provided" },
  ]);

  // ============ CAPTURE: pipeline real de la app ============
  // Corre exactamente lo que hace el POST de /api/discovered-groups (persistido
  // en discovered_groups) y devuelve el resultado completo.
  let ownerJid: string | null = null;
  let chatGroups: { remoteJid: string; name: string }[] = [];
  let adminGroups: { group_jid: string; group_name: string | null; group_picture: string | null; saved: boolean }[] = [];

  try {
    ownerJid = await fetchInstanceOwnerJid(base, key, name);
    const chatsResult = await fetchAllChats(base, key, name);
    if (chatsResult.ok) chatGroups = chatsResult.data;
    adminGroups = await runGroupDiscovery(supabase, instance.id);
  } catch (e) {
    adminGroups = [];
  }

  // ============ BÚSQUEDA POR NOMBRE ============
  // ?name=... busca en findChats los grupos que contengan ese nombre (case
  // insensitive) y corre findGroupInfos para cada uno → vemos qué reporta
  // Evolution (nombre, admin, imagen) para un grupo concreto.
  let byName: Array<{ group_jid: string; chat_name: string; group_name: string | null; is_admin: boolean | null; picture_url: string | null; participants?: number }> = [];
  if (searchName) {
    const q = searchName.trim().toLowerCase();
    const matches = chatGroups.filter((c) => c.name.toLowerCase().includes(q));
    byName = await mapLimit(matches, 4, async ({ remoteJid, name: chatName }) => {
      const info = await findGroupInfos(base, key, name, remoteJid, instance.owner_jid || undefined, instance.owner_lid || undefined);
      if (info.ok && info.data) {
        return {
          group_jid: remoteJid,
          chat_name: chatName,
          group_name: info.data.name || chatName || null,
          is_admin: info.data.isAdmin ?? null,
          picture_url: info.data.pictureUrl ?? null,
          participants: undefined,
        };
      }
      return {
        group_jid: remoteJid,
        chat_name: chatName,
        group_name: null,
        is_admin: null,
        picture_url: null,
        participants: undefined,
      };
    });
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
        groupsFound: chatGroups.length,
        groupsAdmin: adminGroups.length,
        adminGroups,
      },
      findChatsSummary: {
        where: summarizeChats(chatWhere),
        takeSkip_500: summarizeChats(chatTakeSkip),
        limitOffset_500: summarizeChats(chatLimitOffset),
        all: summarizeChats(chatAll),
      },
      fetchAllGroups: groups,
      connectionState: connection,
      findGroupInfos: groupInfo,
      fetchInstances: instances,
    },
  });
}