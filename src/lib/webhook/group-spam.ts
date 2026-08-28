import { deleteMessage, sendGroupMessage } from "@/lib/evolution-multi";
import { containsLink, extractDomains } from "@/lib/supabase/types";

/**
 * Spam / moderation filter for group messages.
 * Requires: Community plan
 *
 * Checks:
 *  1. Banned words (configurable per group): deletes the message and
 *     optionally sends an auto-reply (banned_words_action).
 *  2. Unauthorized links: deletes the message (existing anti-spam).
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
    .select(
      "spam_filter_enabled, block_all_links, allowed_domains, " +
        "banned_words_enabled, banned_words, banned_words_action, banned_words_reply"
    )
    .eq("instance_id", grpInstance.id)
    .eq("group_jid", remoteJid)
    .maybeSingle<{
      spam_filter_enabled: boolean;
      block_all_links: boolean;
      allowed_domains: string[];
      banned_words_enabled: boolean;
      banned_words: string[];
      banned_words_action: "delete" | "delete_and_reply";
      banned_words_reply: string | null;
    }>();

  if (!grpSettings || !msgId || !plainText) return null;

  // --- 1. Banned words moderation ---
  if (grpSettings.banned_words_enabled && grpSettings.banned_words?.length > 0) {
    const lower = plainText.toLowerCase();
    const hit = grpSettings.banned_words.some((word) => lower.includes(word));

    if (hit) {
      await deleteMessage(
        grpInstance.evolution_api_url, grpInstance.evolution_api_key,
        grpInstance.instance_name, msgId, remoteJid, false,
      );
      console.log("[webhook] palabra prohibida eliminada en grupo", {
        group: remoteJid, from: senderJid, text: plainText.slice(0, 80),
      });

      if (
        grpSettings.banned_words_action === "delete_and_reply" &&
        grpSettings.banned_words_reply
      ) {
        await sendGroupMessage(
          grpInstance.evolution_api_url, grpInstance.evolution_api_key,
          grpInstance.instance_name, remoteJid, grpSettings.banned_words_reply,
          undefined, 1500,
        );
        return { status: "spam_deleted_replied" as const };
      }
      return { status: "spam_deleted" as const };
    }
  }

  // --- 2. Link anti-spam (existing) ---
  if (grpSettings.spam_filter_enabled && containsLink(plainText)) {
    const msgDomains = extractDomains(plainText);
    const allowed = grpSettings.allowed_domains || [];
    const isAllowed = !grpSettings.block_all_links && msgDomains.some((d) => allowed.includes(d));

    if (!isAllowed) {
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