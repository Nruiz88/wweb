import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { MenuConfig } from "@/lib/supabase/types";
import type { WebhookContext } from "./context";

// Button id used to signal "go back to the parent menu".
function backButtonId(parentId: string): string {
  return `menu_back_${parentId}`;
}

// In-memory state for plain-text menu fallback (Evolution 2.3.7 buttons fail):
// remembers which menu is currently shown per conversation so "0"/"volver"
// can re-send the parent menu.
const activeMenu = new Map<string, { config: MenuConfig; parentId?: string }>();
const MENU_TTL_MS = 30 * 60 * 1000;

function menuKey(instanceName: string, phoneNumber: string): string {
  return `${instanceName}:${phoneNumber}`;
}

function setActiveMenu(instanceName: string, phoneNumber: string, config: MenuConfig, parentId?: string): void {
  const key = menuKey(instanceName, phoneNumber);
  activeMenu.set(key, { config, parentId });
  setTimeout(() => activeMenu.delete(key), MENU_TTL_MS);
}

/** Look up the currently shown menu for a conversation. */
export function getActiveMenu(instanceName: string, phoneNumber: string): { config: MenuConfig; parentId?: string } | undefined {
  return activeMenu.get(menuKey(instanceName, phoneNumber));
}

/** Clear the active-menu state (e.g. after "volver"). */
export function clearActiveMenu(instanceName: string, phoneNumber: string): void {
  activeMenu.delete(menuKey(instanceName, phoneNumber));
}

/**
 * Send a menu (interactive buttons) response.
 * Falls back to plain text if buttons fail.
 * When `backToId` is provided (a submenu), a "⬅ Volver" button is appended
 * that returns to the parent menu.
 */
export async function sendMenuResponse(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  phoneNumber: string,
  menu: MenuConfig,
  backToId?: string,
): Promise<boolean> {
  const buttons: ButtonItem[] = menu.buttons.slice(0, 3).map((b) => ({
    type: "reply",
    displayText: b.text,
    id: b.id,
  }));

  // Submenus always get a native back button (max 3 real options + back).
  if (backToId) {
    buttons.push({ type: "reply", displayText: "⬅ Volver", id: backButtonId(backToId) });
  }

  const result = await sendButtonMessage(
    evoUrl, evoKey, instanceName, phoneNumber,
    menu.title, menu.description, buttons, menu.footer, 1500,
  );

  if (result.ok) {
    // Remember the shown menu so "0"/"volver" (text fallback) can go back.
    setActiveMenu(instanceName, phoneNumber, menu, backToId);
    return true;
  }

  // Fallback: plain text with numbered options + back
  console.warn("[webhook] botones fallaron, fallback a texto", { error: result.message });
  const fallback = menu.buttons.map((b, i) => `${i + 1}. ${b.text}`).join("\n");
  let text = `${menu.title}\n\n${menu.description}\n\n${fallback}`;
  if (backToId) text += `\n\n0️⃣ ⬅ Volver`;
  const fallbackResult = await sendTextMessage(evoUrl, evoKey, instanceName, phoneNumber, text, 1500);
  if (fallbackResult.ok) {
    setActiveMenu(instanceName, phoneNumber, menu, backToId);
  }
  return fallbackResult.ok;
}

/**
 * Handle a plain-text menu selection when buttons failed (2.3.7 text fallback).
 * The menu was shown as numbered text; the user replies with "1"/"2"/"3" to
 * pick an option, or "0"/"volver" to go back to the parent menu.
 */
export async function handleMenuTextReply(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName } = ctx;

  const state = getActiveMenu(instanceName, phoneNumber);
  if (!state) return null;

  const clean = effectiveText.trim().toLowerCase();

  // Back: 0 / volver / atras
  if (clean === "0" || clean === "volver" || clean === "atras" || clean === "back") {
    clearActiveMenu(instanceName, phoneNumber);
    if (state.parentId) {
      const parent = ctx.autoResponses?.find((ar) => ar.id === state.parentId);
      if (parent?.menu_config) {
        await sendMenuResponse(
          instance.evolution_api_url, instance.evolution_api_key,
          instance.instance_name, phoneNumber, parent.menu_config,
        );
        return { status: "success", matched: "[volver menú]" };
      }
    }
    return null;
  }

  // Option pick: 1-3
  const idx = Number(clean) - 1;
  if (!/^[1-3]$/.test(clean)) return null;
  const option = state.config.buttons[idx];
  if (!option) return null;

  if (option.target_id) {
    const { data: target } = await supabase
      .from("auto_responses")
      .select("id, response_text, response_type, menu_config, user_id")
      .eq("id", option.target_id)
      .eq("is_active", true)
      .single();

    if (target) {
      let ok = false;
      if (target.response_type === "menu" && target.menu_config) {
        ok = await sendMenuResponse(
          instance.evolution_api_url, instance.evolution_api_key,
          instance.instance_name, phoneNumber, target.menu_config, state.parentId || undefined,
        );
      } else {
        const r = await sendTextMessage(
          instance.evolution_api_url, instance.evolution_api_key,
          instance.instance_name, phoneNumber, target.response_text, 1500,
        );
        ok = r.ok;
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
      return ok ? { status: "success", matched: `[botón: ${effectiveText}]` } : null;
    }
  }

  // No target: reply with the option text itself
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, option.text, 1500,
  );
  return { status: "success", matched: `[botón: ${effectiveText}]` };
}

/**
 * Handle button/list tap responses from interactive menus.
 * Looks up the tapped button text in menu_config.buttons.
 * Requires: Starter plan
 */
export async function handleMenuTap(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName, rawButtonId } = ctx;

  if (!ctx.buttonText && !ctx.listText) return null;

  const autoResponses = ctx.autoResponses;
  if (!autoResponses) return null;

  // Native back button: menu_back_<parentId>
  const backMatch = (rawButtonId || effectiveText || "").match(/^menu_back_(.+)$/);
  if (backMatch) {
    const parentId = backMatch[1];
    const parent = autoResponses.find((ar) => ar.id === parentId);
    if (parent?.menu_config) {
      await sendMenuResponse(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber, parent.menu_config,
      );
      return { status: "success", matched: "[volver menú]" };
    }
  }

  for (const ar of autoResponses) {
    if (!ar.menu_config?.buttons) continue;
    const tappedBtn = (ar.menu_config.buttons as { id: string; text: string; target_id: string | null }[]).find(
      (btn) => btn.text === effectiveText || btn.id === effectiveText || btn.id === rawButtonId,
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
            // Submenu: add a native back button to the parent menu (ar).
            sendOk = await sendMenuResponse(
              instance.evolution_api_url, instance.evolution_api_key,
              instance.instance_name, phoneNumber, target.menu_config, ar.id,
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