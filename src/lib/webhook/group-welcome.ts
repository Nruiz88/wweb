import { sendGroupMessage } from "@/lib/evolution-multi";

/**
 * Handles group-participants.update events.
 * When someone joins a group, sends a welcome message with @mention.
 * Requires: Community plan
 */
export async function handleGroupWelcome(ctx: {
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerClient>>;
  instanceName: string;
  groupJid: string;
  participantJid: string;
  action: string;
  bodyInstance: string;
}) {
  const { supabase, groupJid, participantJid, action, bodyInstance } = ctx;

  if (action !== "add" || !groupJid || !participantJid) {
    return null;
  }

  const { data: instance } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key")
    .eq("instance_name", bodyInstance)
    .single();

  if (!instance) return null;

  const { data: groupConfig } = await supabase
    .from("group_settings")
    .select("welcome_enabled, welcome_message")
    .eq("instance_id", instance.id)
    .eq("group_jid", groupJid)
    .single();

  if (groupConfig?.welcome_enabled && groupConfig.welcome_message) {
    const phone = participantJid.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "");
    const mentionText = `@${phone}`;
    const welcomeText = groupConfig.welcome_message.replace("@usuario", mentionText);

    await sendGroupMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, groupJid, welcomeText,
      [participantJid], 2000,
    );

    console.log("[webhook] bienvenida en grupo", { group: groupJid, participant: participantJid });
    return { status: "success" };
  }

  return null;
}
