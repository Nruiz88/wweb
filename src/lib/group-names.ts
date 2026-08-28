import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAllGroups,
  fetchInstanceOwnerJid,
  findGroupInfos,
} from "@/lib/evolution-multi";

/** Live status of a group: real name + whether the bot is admin. */
export interface GroupStatus {
  name: string;
  isAdmin: boolean;
}

/**
 * Fetch live group status (real name + bot admin flag) for an instance.
 * Returns an empty map on any failure so callers never block.
 * The name comes from Evolution's `subject` field (per official docs);
 * when fetchAllGroups omits it, we resolve it per-group with findGroupInfos.
 */
export async function fetchGroupStatusMap(
  supabase: SupabaseClient,
  instanceId: string,
): Promise<Map<string, GroupStatus>> {
  const { data: instance } = await supabase
    .from("instances")
    .select("instance_name, evolution_api_url, evolution_api_key")
    .eq("id", instanceId)
    .single();
  if (!instance) return new Map();

  const { instance_name, evolution_api_url, evolution_api_key } = instance;

  const ownerJid = await fetchInstanceOwnerJid(
    evolution_api_url,
    evolution_api_key,
    instance_name,
  );

  const result = await fetchAllGroups(
    evolution_api_url,
    evolution_api_key,
    instance_name,
    ownerJid ?? undefined,
    false,
  );
  if (!result.ok) return new Map();

  // Sin participants en fetchAllGroups (lento, issue #1883): confirmamos
  // nombre + admin por grupo con findGroupInfos (un grupo, liviano) en paralelo.
  const map = new Map<string, GroupStatus>();
  await Promise.all(
    result.data.map(async (g) => {
      let name = g.name;
      let isAdmin = g.isAdmin === true;
      const info = await findGroupInfos(evolution_api_url, evolution_api_key, instance_name, g.id, ownerJid ?? undefined);
      if (info.ok && info.data) {
        name = info.data.name || name;
        isAdmin = isAdmin || info.data.isAdmin === true;
      }
      map.set(g.id, { name, isAdmin });
    }),
  );

  return map;
}

/**
 * Overwrite stored group names with the live Evolution names for the given rows,
 * and return only the rows where the bot is admin. Always prefers the live name
 * (fixes the legacy pushName bug where the sender's name was stored as
 * group_name in discovered_groups / group_settings).
 *
 * @returns the rows the bot can administer (isAdmin === true). Rows for groups
 *          where the bot is not admin are dropped.
 */
export async function syncGroupNamesAndFilterAdmin(
  supabase: SupabaseClient,
  instanceId: string,
  rows: Array<{ id: string; group_jid: string; group_name: string | null }>,
): Promise<typeof rows> {
  if (rows.length === 0) return [];

  const statusByJid = await fetchGroupStatusMap(supabase, instanceId);
  if (statusByJid.size === 0) {
    // Evolution not reachable / not connected: keep rows as-is but do not
    // claim admin status (the caller decides).
    return rows;
  }

  const adminRows: typeof rows = [];
  for (const row of rows) {
    const status = statusByJid.get(row.group_jid);
    if (!status) continue; // not in Evolution's group list → skip
    if (!status.isAdmin) continue; // bot is not admin → hide

    if (status.name && status.name !== row.group_name) {
      row.group_name = status.name;
      await supabase
        .from("discovered_groups")
        .update({ group_name: status.name })
        .eq("id", row.id);
    }
    adminRows.push(row);
  }
  return adminRows;
}

/**
 * Overwrite group names in group_settings with the live Evolution names.
 * Unlike syncGroupNamesAndFilterAdmin, this keeps ALL rows (configured groups
 * are always shown regardless of admin status) and only fixes the stored name.
 */
export async function syncConfiguredGroupNames(
  supabase: SupabaseClient,
  instanceId: string,
  rows: Array<{ id: string; group_jid: string; group_name: string | null }>,
): Promise<typeof rows> {
  if (rows.length === 0) return rows;

  const statusByJid = await fetchGroupStatusMap(supabase, instanceId);
  if (statusByJid.size === 0) return rows;

  for (const row of rows) {
    const status = statusByJid.get(row.group_jid);
    if (!status) continue;
    if (status.name && status.name !== row.group_name) {
      row.group_name = status.name;
      await supabase
        .from("group_settings")
        .update({ group_name: status.name })
        .eq("id", row.id);
    }
  }
  return rows;
}