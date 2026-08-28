import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllChats, fetchInstanceOwnerJid, findGroupInfos, mapLimit } from "@/lib/evolution-multi";

// Un grupo verificado como admin se considera "fresco" durante 24h → no se
// vuelve a consultar Evolution en cada "Buscar grupos" (evita flakiness por
// timeouts/429 y hace la lista estable y rápida).
const ADMIN_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Ejecuta la búsqueda completa de grupos donde el bot es admin.
 *
 * Pipeline:
 * 1. Enumerar grupos con findChats (DB local, rápido) + fusionar con los JIDs
 *    ya capturados en discovered_groups / group_settings.
 * 2. Por grupo, confirmar nombre + admin con findGroupInfos (usa el phoneNumber
 *    del bot → detección correcta incluso con LID). Resultado PERSISTIDO en
 *    discovered_groups (is_admin + verified_at): lo verificado no se vuelve a
 *    consultar dentro de 24h.
 * 3. Devolver solo los grupos donde el bot es admin Y tienen nombre real.
 *    Nunca se expone el JID al usuario.
 */
export async function runGroupDiscovery(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<Array<{ group_jid: string; group_name: string | null; saved: boolean }>> {
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
      .select("group_jid, group_name, is_admin, verified_at")
      .eq("instance_id", instanceId),
  ]);

  const savedMap = new Map((savedRes.data || []).map((g) => [g.group_jid, g.group_name]));
  const discoveredRows = new Map<string, { group_name: string | null; is_admin: boolean | null; verified_at: string | null }>();
  for (const g of discRes.data || []) {
    discoveredRows.set(g.group_jid, g);
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

  const now = Date.now();

  const verified = await mapLimit(
    [...jidMap.entries()].map(([jid, name]) => ({ jid, name })),
    4,
    async ({ jid, name }) => {
      // Admin ya verificado recientemente → no volver a consultar Evolution.
      const known = discoveredRows.get(jid);
      if (known && known.is_admin === true && known.verified_at && now - new Date(known.verified_at).getTime() < ADMIN_FRESH_MS) {
        return { jid, name: known.group_name || name, isAdmin: true };
      }

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
        // Persistir (best-effort): si la columna no existe aún, el error se ignora.
        await supabase.from("discovered_groups").upsert(
          {
            instance_id: instanceId,
            group_jid: jid,
            group_name: finalName || null,
            is_admin: isAdmin,
            verified_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "instance_id,group_jid" },
        );
        return { jid, name: finalName, isAdmin };
      }

      // No se pudo verificar (timeout/429): no se persiste → se reintenta la
      // próxima búsqueda.
      return { jid, name, isAdmin: false };
    },
  );

  return verified
    .filter((g) => g.isAdmin && (g.name || savedMap.get(g.jid)))
    .map((g) => ({
      group_jid: g.jid,
      group_name: g.name || savedMap.get(g.jid) || null,
      saved: savedMap.has(g.jid),
    }))
    .sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));
}