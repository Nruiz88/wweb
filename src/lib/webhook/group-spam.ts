import { deleteMessage } from "@/lib/evolution-multi";
import { containsLink, extractDomains } from "@/lib/supabase/types";

/**
 * Spam filter for group messages.
 * Deletes messages containing unauthorized links.
 * Requires: Community plan
 */
export async function handleGroupSpam(ctx: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerClient>>;
  instanceName: string;
  remoteJid: string;
  plainText: string;
  msgId?: string;
  senderJid?: string;
  bodyInstance: string;
}) {
  const { supabase, remoteJid, plainText, msgId, senderJid, bodyInstance } = ctx;

  const { data: grpInstance } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key")
    .eq("instance_name", bodyInstance)
    .single();

  if (!grpInstance) return { status: "error" as const, error: "Instance not found" };

  const { data: grpSettings } = await supabase
    .from("group_settings")
    .select("spam_filter_enabled, block_all_links, allowed_domains")
    .eq("instance_id", grpInstance.id)
    .eq("group_jid", remoteJid)
    .single();

  if (grpSettings?.spam_filter_enabled && plainText && containsLink(plainText)) {
    const msgDomains = extractDomains(plainText);
    const allowed = grpSettings.allowed_domains || [];
    const isAllowed = !grpSettings.block_all_links && msgDomains.some((d) => allowed.includes(d));

    if (!isAllowed && msgId) {
      await deleteMessage(
        grpInstance.evolution_api_url, grpInstance.evolution_api_key,
        grpInstance.instance_name, msgId, remoteJid, false,
      );
      console.log("[webhook] spam eliminado en grupo", { group: remoteJid, from: senderJid, text: plainText.slice(0, 80) });
      return { status: "spam_deleted" as const };
    }
  }

  return null;
}
