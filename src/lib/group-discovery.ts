import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllChats, fetchInstanceOwnerJid, findGroupInfos, mapLimit } from "@/lib/evolution-multi";

// Lote por "Buscar grupos": se verifican como máximo esta cantidad de grupos
// nuevos por consulta. El resto se acumula en discovered_groups (is_admin +
// verified_at) y se completa en las siguientes búsquedas → cada run NO vuelve a
// consultar lo que ya tiene (ni guardado ni verificado en 24h).
const BATCH_LIMIT = 15;
const VERIFIED_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Búsqueda incremental de grupos donde el bot es admin.
 *
 * Pipeline:
 * 1. Enumerar grupos con findChats (DB local, rápido) + fusionar con los JIDs
 *    ya capturados en discovered_groups / group_settings.
 * 2. Particionar:
 *    - guardados (group_settings) → NO se consultan ni se muestran (están en
 *      "Grupos configurados").
 *    - ya verificados (discovered_groups.verified_at < 24h) → NO se vuelven a
 *      consultar; se suman al resultado si son admin.
 *    - resto → se verifica un LOTE de hasta BATCH_LIMIT con findGroupInfos
 *      (usa phoneNumber → detección admin correcta incluso con LID) y se
 *      persiste (is_admin + verified_at).
 * 3. Devuelve los grupos admin NO guardados (para que el usuario los agregue).
 *    Nunca se expone el JID al usuario.
 */
export async function runGroupDiscovery(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<Array<{ group_jid: string; group_name: string | null; group_picture: string | null; saved: boolean }>> {
  const { data: instance } = await supabase
    .from("instances")
    .select("instance_name, evolution_api_url, evolution_api_key")
    .eq("id", instanceId)
    .single();
  if (!instance) return [];

  const [savedRes, discRes] = await Promise.all([
    supabase.from("group_settings").select("group_jid, group_name").eq("instance_id", instanceId),
    supabase
      .from("discovered_groups")
      .select("group_jid, group_name, group_picture, is_admin, verified_at")
      .eq("instance_id", instanceId),
  ]);

  const savedSet = new Set((savedRes.data || []).map((g) => g.group_jid));

  // Grupos ya verificados hace menos de 24h → no se vuelven a consultar.
  const now = Date.now();
  const freshVerified = new Map<string, { group_name: string | null; group_picture: string | null; is_admin: boolean }>();
  for (const g of discRes.data || []) {
    if (g.verified_at && now - new Date(g.verified_at).getTime() < VERIFIED_FRESH_MS) {
      freshVerified.set(g.group_jid, {
        group_name: g.group_name,
        group_picture: g.group_picture,
        is_admin: g.is_admin === true,
      });
    }
  }

  const ownerJid = await fetchInstanceOwnerJid(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );

  const chatsResult = await fetchAllChats(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
  );

  const jidMap = new Map<string, string>();
  if (chatsResult.ok) {
    for (const c of chatsResult.data) jidMap.set(c.remoteJid, c.name);
  }
  for (const g of [...(discRes.data || []), ...(savedRes.data || [])] as Array<{ group_jid: string; group_name: string | null }>) {
    if (!jidMap.has(g.group_jid)) jidMap.set(g.group_jid, g.group_name || "");
  }

  // Solo el lote de grupos nuevos (ni guardados, ni verificados en 24h).
  const toCheck = [...jidMap.entries()]
    .filter(([jid]) => !savedSet.has(jid) && !freshVerified.has(jid))
    .slice(0, BATCH_LIMIT)
    .map(([jid, name]) => ({ jid, name }));

  const adminGroups: Array<{ group_jid: string; group_name: string | null; group_picture: string | null; saved: boolean }> = [];

  // Verificar el lote y persistir.
  await mapLimit(toCheck, 4, async ({ jid, name }) => {
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
      const isAdmin = info.data.isAdmin === true;
      const finalName = info.data.name || name;
      const picture = info.data.pictureUrl ?? null;
      await supabase.from("discovered_groups").upsert(
        {
          instance_id: instanceId,
          group_jid: jid,
          group_name: finalName || null,
          group_picture: picture,
          is_admin: isAdmin,
          verified_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "instance_id,group_jid" },
      );
      if (isAdmin && finalName && !savedSet.has(jid)) {
        adminGroups.push({ group_jid: jid, group_name: finalName, group_picture: picture, saved: false });
      }
    }
  });

  // Sumar los admin ya verificados en búsquedas anteriores (y no guardados).
  for (const [jid, v] of freshVerified) {
    if (v.is_admin && v.group_name && !savedSet.has(jid)) {
      adminGroups.push({ group_jid: jid, group_name: v.group_name, group_picture: v.group_picture, saved: false });
    }
  }

  return adminGroups.sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));
}