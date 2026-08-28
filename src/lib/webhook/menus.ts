import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { MenuConfig } from "@/lib/supabase/types";
import type { WebhookContext } from "./context";

/**
 * Send a menu (interactive buttons) response.
 * Falls back to plain text if buttons fail.
 */
export async function sendMenuResponse(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  phoneNumber: string,
  menu: MenuConfig,
): Promise<boolean> {
  const buttons: ButtonItem[] = menu.buttons.slice(0, 3).map((b) => ({
    type: "reply",
    displayText: b.text,
    id: b.id,
  }));

  const result = await sendButtonMessage(
    evoUrl, evoKey, instanceName, phoneNumber,
    menu.title, menu.description, buttons, menu.footer, 1500,
  );

  if (result.ok) return true;

  // Fallback: plain text
  console.warn("[webhook] botones fallaron, fallback a texto", { error: result.message });
  const fallback = menu.buttons.map((b) => `• ${b.text}`).join("\n");
  const text = `${menu.title}\n\n${menu.description}\n\n${fallback}`;
  const fallbackResult = await sendTextMessage(evoUrl, evoKey, instanceName, phoneNumber, text, 1500);
  return fallbackResult.ok;
}

/**
 * Handle button/list tap responses from interactive menus.
 * Looks up the tapped button text in menu_config.buttons.
 * Requires: Starter plan
 */
export async function handleMenuTap(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  if (!ctx.buttonText && !ctx.listText) return null;

  const autoResponses = ctx.autoResponses;
  if (!autoResponses) return null;

  for (const ar of autoResponses) {
    if (!ar.menu_config?.buttons) continue;
    const tappedBtn = (ar.menu_config.buttons as { id: string; text: string; target_id: string | null }[]).find(
      (btn) => btn.text === effectiveText || btn.id === effectiveText,
    );

    if (tappedBtn) {
      if (tappedBtn.target_id) {
        const { data: target } = await supabase
          .from("auto_responses")
          .select("id, response_text, response_type, menu_config, user_id")
          .eq("id", tappedBtn.target_id)
          .eq("is_active", true)
          .single();

        if (target) {
          let sendOk = false;
          if (target.response_type === "menu" && target.menu_config) {
            sendOk = await sendMenuResponse(
              instance.evolution_api_url, instance.evolution_api_key,
              instance.instance_name, phoneNumber, target.menu_config,
            );
          } else {
            const r = await sendTextMessage(
              instance.evolution_api_url, instance.evolution_api_key,
              instance.instance_name, phoneNumber, target.response_text, 1500,
            );
            sendOk = r.ok;
          }

          try {
            await supabase.from("response_logs").insert({
              instance_id: instance.id,
              auto_response_id: target.id,
              user_id: target.user_id,
              incoming_phone: remoteJid,
              incoming_message: effectiveText,
              matched_keyword: `[botón: ${effectiveText}]`,
            });
          } catch { /* non-critical */ }

          if (sendOk) {
            console.log("[webhook] respuesta a botón enviada", { instance: instanceName, from: remoteJid, button: effectiveText });
            return { status: "success", matched: `[botón: ${effectiveText}]` };
          }
        }
      }
      break;
    }
  }

  return null;
}
