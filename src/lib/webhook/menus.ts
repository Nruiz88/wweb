import { sendTextMessage, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { MenuConfig } from "@/lib/db/types";
import { registrarRespuesta, type WebhookContext } from "./context";
import { query, generateId } from "../db";
import { isValidId } from "@/lib/validation";
import { buildCatalogMenus, buildCategoryMenu } from "./catalog";
import { getBusinessName } from "@/lib/business-name";
import type { CatalogItem } from "@/lib/db/types";

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
 * Los botones interactivos de Evolution NO llegan al usuario en esta
 * instancia: `sendButtonMessage` devuelve 200 con un interactiveMessage
 * envuelto en `viewOnceMessage`, así que el mensaje queda marcado "ver una
 * vez" y no se renderiza. Como devuelve `ok`, el fallback a texto NUNCA se
 * disparaba y el catálogo y los menús quedaban mudos.
 *
 * Por eso el texto es el camino PRINCIPAL y los botones quedan opt-in con
 * MENU_USE_BUTTONS=1, por si el server de Evolution se actualiza.
 */
const USE_BUTTONS = process.env.MENU_USE_BUTTONS === "1";

/** Máximo de opciones que se listan en un menú de texto. */
const MAX_TEXT_OPTIONS = 9;

/** Marca un botón de navegación ("Ver más"), que no es una opción real. */
function isNavOption(text: string): boolean {
  return /ver\s*más/i.test(text);
}

/**
 * Muestra un menú.
 *
 * Texto numerado (el cliente responde con el número) por defecto; botones si
 * MENU_USE_BUTTONS=1. Cuando `backToId` viene, se ofrece "0 = volver".
 */
export async function sendMenuResponse(
  evoUrl: string,
  evoKey: string,
  instanceName: string,
  phoneNumber: string,
  menu: MenuConfig,
  backToId?: string,
): Promise<boolean> {
  const shown = menu.buttons.slice(0, MAX_TEXT_OPTIONS);

  if (USE_BUTTONS) {
    const buttons: ButtonItem[] = menu.buttons.slice(0, 3).map((b) => ({
      type: "reply",
      displayText: b.text,
      id: b.id,
    }));
    if (backToId) {
      buttons.push({ type: "reply", displayText: "⬅ Volver", id: backButtonId(backToId) });
    }
    const result = await sendButtonMessage(
      evoUrl, evoKey, instanceName, phoneNumber,
      menu.title, menu.description, buttons, menu.footer, 1500,
    );
    if (result.ok) {
      setActiveMenu(instanceName, phoneNumber, { ...menu, buttons: shown }, backToId);
      return true;
    }
    console.warn("[webhook] botones fallaron, uso texto", { error: result.message });
  }

  // Camino principal: texto. Se separa la navegación de las opciones reales
  // para que el número de "ver más" no se confunda con un producto.
  const options = shown.filter((b) => !isNavOption(b.text));
  const nav = shown.filter((b) => isNavOption(b.text));

  const lines: string[] = [];
  options.forEach((b, i) => {
    lines.push(`  ┣ ${String(i + 1).padStart(2, " ")}. ${b.text}`);
  });
  nav.forEach((b, i) => {
    lines.push(`  ┗ ${String(options.length + i + 1).padStart(2, " ")}. ${b.text}`);
  });

  const parts: string[] = [];
  if (menu.title) parts.push(`*${menu.title}*`);
  if (menu.description) parts.push(`_${menu.description}_`);
  parts.push("━━━━━━━━━━━━━━━━━━━━━━");
  parts.push("  _Elegí con el número:_");
  parts.push("");
  parts.push(lines.join("\n"));

  const tail: string[] = [];
  if (backToId) tail.push("  0️⃣  🔙 Volver");
  if (menu.footer) tail.push(`  _${menu.footer}_`);
  if (tail.length) {
    parts.push("");
    parts.push(tail.join("\n"));
  }

  const result = await sendTextMessage(evoUrl, evoKey, instanceName, phoneNumber, parts.join("\n"), 1200);
  if (result.ok) {
    setActiveMenu(instanceName, phoneNumber, { ...menu, buttons: shown }, backToId);
  }
  return result.ok;
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

  // Opción: 1-9 (el menú de texto puede listar más de 3, a diferencia de los
  // quick replies de WhatsApp que topan en 3).
  if (!/^[1-9]$/.test(clean)) return null;
  const idx = Number(clean) - 1;
  const option = state.config.buttons[idx];
  if (!option) return null;

  if (option.target_id) {
    // Primero los targets del catálogo (menu_p<N>, order_<id>): antes se
    // buscaban solo en auto_responses, donde no están, así que al elegir un
    // producto desde el menú de texto NO se creaba ningún pedido y el bot
    // devolvía el texto de la opción como si nada.
    const catalogResult = await handleCatalogTarget(ctx, option.target_id);
    if (catalogResult) return catalogResult;

    const targets = await query<{ id: string; response_text: string; response_type: string; menu_config: any }>(
      "SELECT id, response_text, response_type, menu_config FROM bots_responses WHERE id = ? AND is_active = true",
      [option.target_id]
    );
    const target = targets?.[0];

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
              await registrarRespuesta(ctx, {
                respuestaId: target.id,
                telefono: remoteJid,
                mensaje: effectiveText,
                coincidencia: `[boton: ${effectiveText}]`,
              });
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
 * Crea el pedido de un producto del catálogo.
 *
 * Compartido por el camino de texto (elegir el número) y el de botones, que
 * antes eran dos implementaciones y solo una funcionaba.
 */
export async function createCatalogOrder(
  ctx: WebhookContext,
  itemId: string,
  quantity = 1,
): Promise<{ ok: boolean; label?: string; totalCents?: number; orderId?: string }> {
  const { supabase, instance, phoneNumber, pushName } = ctx;
  if (!isValidId(itemId)) return { ok: false };

  const items = await query<{ id: string; label: string; price_cents: number; active: boolean }>(
    "SELECT id, label, price_cents, active FROM bots_catalog_items WHERE id = ? AND active = true",
    [itemId]
  );
  const item = items?.[0];
  if (!item) return { ok: false };

  const qty = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
  // `orders.id` es VARCHAR sin AUTO_INCREMENT → `insertId` daba 0 y el
  // `if (insertId)` caía al branch de "Producto no disponible": el pedido se
  // guardaba pero el cliente recibía un error.
  /* Con el cliente, no con `query()` (que es de solo lectura).

     El id lo pone la base (`uuid default gen_random_uuid()`) y se pide
     con `.select("id")`, porque `confirmOrder` necesita devolverlo para
     el "confirmar" del cliente.

     Antes se fabricaba con `generateId()` y el `insertId` de mysql2
     daba siempre 0, así que el `if (insertId)` de abajo nunca entraba:
     el pedido se guardaba pero el cliente recibía "Producto no
     disponible". El comentario sobre eso se queda porque describe un
     fallo real que ya no puede volver a pasar de esa forma. */
  const { data: pedido, error: errorPedido } = await supabase
    .from("bots_orders")
    .insert({
      bot_id: instance.id,
      customer_phone: phoneNumber,
      customer_name: pushName || null,
      catalog_item_id: item.id,
      option_label: item.label,
      quantity: qty,
      price_cents: item.price_cents,
      status: "pending",
    })
    .select("id")
    .single();

  const orderId = pedido?.id;

  if (errorPedido) {
    console.error("[webhook] no se pudo crear el pedido", {
      bot: instance.instance_name,
      item: item.label,
      error: errorPedido.message,
    });
    return { ok: false, label: item.label };
  }

  return { ok: true, label: item.label, totalCents: item.price_cents * qty, orderId };
}

function money(cents: number): string {
  const pesos = cents / 100;
  return Number.isInteger(pesos) ? `$${pesos}` : `$${pesos.toFixed(2)}`;
}

/** Confirmación del pedido, con el nombre del negocio. */
export async function confirmOrder(
  ctx: WebhookContext,
  label: string,
  totalCents: number,
  quantity: number,
): Promise<void> {
  const { instance, phoneNumber } = ctx;
  const business = await getBusinessName(instance.id, instance.instance_name);
  const line = quantity > 1 ? `${quantity} × ${label}` : label;
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "╭━━━━━━━━━━━━━━━━━━━━━╮\n" +
      "   🧾  *PEDIDO ANOTADO*\n" +
      "╰━━━━━━━━━━━━━━━━━━━━━╯\n\n" +
      `📦  *${line}*\n` +
      `💰  *${money(totalCents)}*\n` +
      `🏪  ${business}\n` +
      "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n" +
      "Te confirmamos por acá. ¡Gracias! 🎉",
    1200,
  );
}

/**
 * Rutea un `target_id` de catálogo. Devuelve el resultado si lo consumió.
 * `menu_p<N>` = página siguiente, `order_<itemId>` = pedir el producto.
 */
async function handleCatalogTarget(
  ctx: WebhookContext,
  targetId: string,
): Promise<{ status: string; matched: string } | null> {
  // Elegir una categoría → listar sus productos.
  const catMatch = /^cat_sub_(.+)$/.exec(targetId);
  if (catMatch) {
    const category = catMatch[1];
    const items = await query<CatalogItem>(
      "SELECT id, label, description, price_cents, active, sort_order, category FROM bots_catalog_items WHERE bot_id = ? AND active = true ORDER BY sort_order ASC",
      [ctx.instance.id]
    );
    if (!items?.length) return null;
    const inCat = items.filter((i) => i.category === category);
    if (inCat.length === 0) return null;
    const sub = buildCategoryMenu(category, inCat);
    await sendMenuResponse(
      ctx.instance.evolution_api_url, ctx.instance.evolution_api_key,
      ctx.instance.instance_name, ctx.phoneNumber, sub[0],
    );
    return { status: "success", matched: `[catálogo categoría: ${category}]` };
  }

  // Página siguiente del catálogo.
  const navMatch = /^menu_p(\d{1,3})$/.exec(targetId);
  if (navMatch) {
    const menus = await catalogPageMenus(ctx, Number(navMatch[1]));
    if (!menus) {
      await sendTextMessage(
        ctx.instance.evolution_api_url, ctx.instance.evolution_api_key,
        ctx.instance.instance_name, ctx.phoneNumber,
        "Esa es la última página 😊\n\nEscribí *menú* para volver a empezar.",
        1200,
      );
      return { status: "success", matched: "[catálogo fuera de rango]" };
    }
    await sendMenuResponse(
      ctx.instance.evolution_api_url, ctx.instance.evolution_api_key,
      ctx.instance.instance_name, ctx.phoneNumber, menus,
    );
    return { status: "success", matched: `[catálogo pág ${navMatch[1]}]` };
  }

  // Productos de una categoría, página siguiente.
  const catNext = /^catnext_(\d{1,3})$/.exec(targetId);
  if (catNext) {
    const page = Number(catNext[1]);
    const items = await query<CatalogItem>(
      "SELECT id, label, description, price_cents, active, sort_order, category FROM bots_catalog_items WHERE bot_id = ? AND active = true ORDER BY sort_order ASC",
      [ctx.instance.id]
    );
    const cats = [...new Set((items || []).map((i) => i.category).filter(Boolean))] as string[];
    const category = cats[0];
    if (!category) return null;
    const sub = buildCategoryMenu(category, (items || []).filter((i) => i.category === category));
    const target = sub[page - 1];
    if (!target) return null;
    await sendMenuResponse(
      ctx.instance.evolution_api_url, ctx.instance.evolution_api_key,
      ctx.instance.instance_name, ctx.phoneNumber, target,
    );
    return { status: "success", matched: `[catálogo ${category} pág ${page}]` };
  }

  const orderMatch = /^order_(.+)$/.exec(targetId);
  if (orderMatch) {
    const created = await createCatalogOrder(ctx, orderMatch[1], 1);
    if (!created.ok) {
      await sendTextMessage(
        ctx.instance.evolution_api_url, ctx.instance.evolution_api_key,
        ctx.instance.instance_name, ctx.phoneNumber,
        "Ese producto ya no está disponible 🤔\n\nEscribí *menú* para ver el catálogo.",
        1200,
      );
      return { status: "success", matched: "[pedido: producto no disponible]" };
    }
    await confirmOrder(ctx, created.label!, created.totalCents!, 1);
    return { status: "success", matched: `[pedido ${created.orderId}]` };
  }

  return null;
}

/** Reconstruye la página N del catálogo (para la navegación). */
async function catalogPageMenus(ctx: WebhookContext, page: number) {
  const items = await query<CatalogItem>(
    "SELECT id, label, description, price_cents, active, sort_order, category FROM bots_catalog_items WHERE bot_id = ? AND active = true ORDER BY sort_order ASC",
    [ctx.instance.id]
  );
  if (!items?.length) return null;
  const { menus } = buildCatalogMenus(items);
  return menus[page - 1] ?? null;
}

/**
 * Handle button/list tap responses from interactive menus.
 * Looks up the tapped button text in menu_config.buttons.
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleMenuTap(ctx: WebhookContext) {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, instanceName, rawButtonId } = ctx;

  if (!ctx.buttonText && !ctx.listText) return null;

  // ---- Catálogo: navegación y pedido (mismo ruteo que el camino de texto) ----
  const raw = rawButtonId || effectiveText || "";
  if (/^menu_p\d+$/.test(raw) || /^order_/.test(raw)) {
    const handled = await handleCatalogTarget(ctx, raw);
    if (handled) return handled;
  }
  
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
        const targets = await query<{ id: string; response_text: string; response_type: string; menu_config: any }>(
          "SELECT id, response_text, response_type, menu_config FROM bots_responses WHERE id = ? AND is_active = true",
          [tappedBtn.target_id]
        );
        const target = targets?.[0];

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

              await registrarRespuesta(ctx, {
                respuestaId: target.id,
                telefono: remoteJid,
                mensaje: effectiveText,
                coincidencia: `[boton: ${effectiveText}]`,
              });

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