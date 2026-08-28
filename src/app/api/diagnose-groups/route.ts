import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";

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

  let instance;
  if (instanceId) {
    const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
    if (!hasAccess) {
      return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
    }
    const { data } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key")
      .eq("id", instanceId)
      .single();
    instance = data;
  } else {
    // Primera instancia creada por el usuario (admin_id)
    const { data } = await supabase
      .from("instances")
      .select("id, instance_name, evolution_api_url, evolution_api_key")
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

  const [instances, groups, groupsNoParticipants, connection, groupInfo] = await Promise.all([
    rawGet(base, key, `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`),
    rawGet(base, key, `/group/fetchAllGroups/${encodeURIComponent(name)}?getParticipants=true`),
    rawGet(base, key, `/group/fetchAllGroups/${encodeURIComponent(name)}?getParticipants=false`),
    rawGet(base, key, `/instance/connectionState/${encodeURIComponent(name)}`),
    groupJid
      ? rawGet(base, key, `/group/findGroupInfos/${encodeURIComponent(name)}?groupJid=${encodeURIComponent(groupJid)}&getParticipants=true`)
      : { httpStatus: null, body: "no groupJid provided" },
  ]);

  return NextResponse.json({
    status: "success",
    data: {
      instanceId: instance.id,
      instanceName: name,
      evolutionApiUrl: base,
      requestedGroupJid: groupJid ?? null,
      fetchInstances: instances,
      fetchAllGroups: groups,
      fetchAllGroupsNoParticipants: groupsNoParticipants,
      connectionState: connection,
      findGroupInfos: groupInfo,
    },
  });
}