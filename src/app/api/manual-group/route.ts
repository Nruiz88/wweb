import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { fetchInstanceOwnerJid, findGroupInfos } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/manual-group — Agregar un grupo por JID (fallback para grupos que
// no aparecen en findChats porque no están en la DB local de Evolution).
// Verifica con findGroupInfos que el bot sea admin y persiste en
// discovered_groups → aparece en la lista de "Buscar grupos" para guardar.
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
  const { instanceId, groupJid } = (body ?? {}) as { instanceId?: string; groupJid?: string };

  if (!instanceId || !groupJid) {
    return NextResponse.json({ status: "error", error: "instanceId and groupJid are required" }, { status: 400 });
  }

  // Normalizar JID (acepta "120363...@g.us" o solo el número).
  const trimmed = groupJid.trim();
  const fullJid = trimmed.includes("@") ? trimmed : `${trimmed}@g.us`;
  if (!/^\d{8,}@g\.us$/i.test(fullJid)) {
    return NextResponse.json({ status: "error", error: "JID de grupo inválido" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: instance } = await supabase
    .from("instances")
    .select("instance_name, evolution_api_url, evolution_api_key, owner_jid, owner_lid")
    .eq("id", instanceId)
    .single();
  if (!instance || !instance.evolution_api_url || !instance.evolution_api_key) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  let ownerJid = instance.owner_jid || null;
  if (!ownerJid) {
    ownerJid = await fetchInstanceOwnerJid(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
    );
    if (ownerJid) {
      await supabase.from("instances").update({ owner_jid: ownerJid }).eq("id", instanceId);
    }
  }

  const info = await findGroupInfos(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    fullJid,
    ownerJid ?? undefined,
    instance.owner_lid || undefined,
  );

  if (!info.ok || !info.data) {
    return NextResponse.json(
      { status: "error", error: "No se pudo obtener el grupo (¿el bot es miembro?)" },
      { status: 404 },
    );
  }

  if (info.data.isAdmin !== true) {
    return NextResponse.json(
      { status: "error", error: "El bot no es administrador de ese grupo" },
      { status: 403 },
    );
  }

  if (!info.data.name) {
    return NextResponse.json({ status: "error", error: "El grupo no tiene nombre" }, { status: 400 });
  }

  const now = new Date().toISOString();
  await supabase.from("discovered_groups").upsert(
    {
      instance_id: instanceId,
      group_jid: fullJid,
      group_name: info.data.name,
      group_picture: info.data.pictureUrl ?? null,
      is_admin: true,
      verified_at: now,
      last_seen_at: now,
    },
    { onConflict: "instance_id,group_jid" },
  );

  return NextResponse.json({
    status: "success",
    data: { group_jid: fullJid, group_name: info.data.name, group_picture: info.data.pictureUrl ?? null, saved: false },
  });
}