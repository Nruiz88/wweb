import { sendTextMessage } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";
import type { CatalogItem } from "@/lib/db/types";
import { query, generateId } from "../db";
import { sendMenuResponse } from "./menus";
import { getBusinessName } from "@/lib/business-name";

export interface MenuConfig {
  title: string;
  description: string;
  footer?: string;
  buttons: Array<{ id: string; text: string; target_id: string | null }>;
}

/** Productos por página en el listado de texto. */
const ITEMS_PER_PAGE = 8;

function priceLabel(cents: number): string {
  const pesos = cents / 100;
  return Number.isInteger(pesos) ? `$${pesos}` : `$${pesos.toFixed(2)}`;
}

/** Id de la página siguiente, para el botón de navegación. */
function nextPageTarget(page: number): string {
  return `menu_p${page + 1}`;
}

/**
 * Arma las páginas del catálogo.
 *
 * Antes eran 2 productos por página: con 4 productos el 4º era inalcanzable
 * desde el chat. Ahora son 8 por página, y si hay más se agrega "Ver más" como
 * última opción numerada.
 *
 * Si hay varias categorías, la primera pantalla muestra las categorías y al
 * elegir una se listan sus productos.
 */
export function buildCatalogMenus(items: CatalogItem[]): { menus: MenuConfig[]; entryMenuId: string } {
  const active = items
    .filter((it) => it.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (active.length === 0) return { menus: [], entryMenuId: "" };

  const namedCategories = [...new Set(active.map((it) => it.category).filter(Boolean))] as string[];

  // ── Nivel 1: categorías (solo si hay 2 o más con nombre) ──────────────
  if (namedCategories.length >= 2) {
    const menus: MenuConfig[] = [];
    for (let i = 0; i < namedCategories.length; i += ITEMS_PER_PAGE) {
      const pageCats = namedCategories.slice(i, i + ITEMS_PER_PAGE);
      const pageNum = Math.floor(i / ITEMS_PER_PAGE) + 1;
      const totalPages = Math.ceil(namedCategories.length / ITEMS_PER_PAGE);
      const buttons: Array<{ id: string; text: string; target_id: string | null }> = pageCats.map((cat) => ({
        id: `cat_${cat}`,
        text: `📂 ${cat}`,
        target_id: `cat_sub_${cat}`,
      }));
      if (i + ITEMS_PER_PAGE < namedCategories.length) {
        buttons.push({ id: `next_p${pageNum}`, text: "➡️ Ver más", target_id: nextPageTarget(pageNum) });
      }
      menus.push({
        title: `Nuestro catálogo — pág ${pageNum}/${totalPages}`,
        description: "¿Qué estás buscando?",
        footer: `${active.length} productos disponibles`,
        buttons,
      });
    }
    return { menus, entryMenuId: "menu_p1" };
  }

  // ── Lista plana de productos ──────────────────────────────────────────
  const menus: MenuConfig[] = [];
  for (let i = 0; i < active.length; i += ITEMS_PER_PAGE) {
    const pageItems = active.slice(i, i + ITEMS_PER_PAGE);
    const pageNum = Math.floor(i / ITEMS_PER_PAGE) + 1;
    const totalPages = Math.ceil(active.length / ITEMS_PER_PAGE);
    const buttons: Array<{ id: string; text: string; target_id: string | null }> = pageItems.map((it) => ({
      id: `opt_${it.id}`,
      text: `${it.label} — ${priceLabel(it.price_cents)}`,
      target_id: `order_${it.id}`,
    }));
    if (i + ITEMS_PER_PAGE < active.length) {
      buttons.push({ id: `next_p${pageNum}`, text: "➡️ Ver más", target_id: nextPageTarget(pageNum) });
    }
    menus.push({
      title: `Nuestro catálogo — pág ${pageNum}/${totalPages}`,
      description: "Elegí con el número lo que quieras:",
      footer: "Te lo dejamos anotado apenas confirmes",
      buttons,
    });
  }

  return { menus, entryMenuId: menus[0] ? "menu_p1" : "" };
}

/**
 * Productos de una categoría, paginados igual que la lista plana.
 * Es lo que se muestra al elegir una categoría del primer nivel.
 */
export function buildCategoryMenu(category: string, items: CatalogItem[]): MenuConfig[] {
  const active = items.filter((it) => it.active).sort((a, b) => a.sort_order - b.sort_order);
  const menus: MenuConfig[] = [];
  for (let i = 0; i < active.length; i += ITEMS_PER_PAGE) {
    const pageItems = active.slice(i, i + ITEMS_PER_PAGE);
    const pageNum = Math.floor(i / ITEMS_PER_PAGE) + 1;
    const totalPages = Math.ceil(active.length / ITEMS_PER_PAGE);
    const buttons: Array<{ id: string; text: string; target_id: string | null }> = pageItems.map((it) => ({
      id: `opt_${it.id}`,
      text: `${it.label} — ${priceLabel(it.price_cents)}`,
      target_id: `order_${it.id}`,
    }));
    if (i + ITEMS_PER_PAGE < active.length) {
      buttons.push({ id: `next_cat_${pageNum}`, text: "➡️ Ver más", target_id: `catnext_${pageNum + 1}` });
    }
    menus.push({
      title: `${category} — pág ${pageNum}/${totalPages}`,
      description: "Elegí con el número:",
      footer: `${active.length} productos`,
      buttons,
    });
  }
  return menus;
}

/**
 * Persist generated catalog menus as auto_responses (type=menu).
 *
 * ⚠️ NO HAY CALLER. `handleMenuTap` busca páginas `catalog_menu_pN` que nunca
 * se crean, así que el "Ver más" del catálogo queda en silencio. Hay que
 * cablearlo para que se llame cuando cambian los productos.
 */
export async function syncCatalogMenus(
  instanceId: string,
  ownerUserId: string,
  items: CatalogItem[],
): Promise<string | null> {
  const { menus } = buildCatalogMenus(items);
  if (menus.length === 0) return null;

  // Remove old catalog menus for this instance
  const old = await query<{ id: string }>(
    "SELECT id FROM auto_responses WHERE instance_id = ? AND response_type = 'menu' AND keyword LIKE ?",
    [instanceId, `catalog_menu_%`]
  );
  if (old && old.length > 0) {
    await query("DELETE FROM auto_responses WHERE id IN (" + old.map(() => "?").join(", ") + ")", old.map((o) => o.id));
  }

  // Insert each page as auto_response with keyword catalog_menu_pN.
  // `auto_responses.user_id` y `response_text` son NOT NULL (y user_id es FK a
  // profiles) → mandar null/vacío daba ER 1048 y la página nunca se creaba.
  // Para un menú, `response_text` es un placeholder: la respuesta real sale de
  // `menu_config`.
  for (let i = 0; i < menus.length; i++) {
    const menu = menus[i];
    const id = generateId();
    await query(
      `INSERT INTO auto_responses (id, instance_id, user_id, response_type, keyword, response_text, menu_config, is_active, priority, created_at, updated_at)
       VALUES (?, ?, ?, 'menu', ?, ?, ?, true, 10, NOW(), NOW())`,
      [id, instanceId, ownerUserId, `catalog_menu_p${i + 1}`, `[catálogo p${i + 1}]`, menu]
    );
  }

  return `catalog_menu_p1`;
}

/**
 * Palabras que abren el catálogo.
 *
 * Antes era coincidencia EXACTA contra una lista corta: "pedido", "catálogo",
 * "quiero", "menu", "catalogo". Si el cliente escribía "hola, tenés alfajores?"
 * o "quiero un flan" no pasaba nada. Ahora se busca la palabra DENTRO del texto
 * y se aceptan las formas que la gente realmente usa.
 */
const CATALOG_TRIGGERS = [
  "menu", "menú", "carta",
  "catalogo", "catálogo",
  "pedido", "pedidos", "encargar", "encargo",
  "producto", "productos", "precios", "lista de precios",
  "quiero", "quisiera", "tienen", "tenes", "venden",
  "comprar", "compro",
];

/** Si el texto parece un pedido del catálogo, devuelve el trigger encontrado. */
export function matchCatalogTrigger(text: string): string | null {
  const t = (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!t) return null;
  for (const trigger of CATALOG_TRIGGERS) {
    const needle = trigger.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // "tienen"/"venden" cuentan como match solo si hay algo más que un
    // saludo, para no interceptar "hola".
    if (needle === "tienen" || needle === "tenes" || needle === "venden") {
      if (t.length > needle.length + 1 && t.includes(needle)) return trigger;
      continue;
    }
    if (t.includes(needle)) return trigger;
  }
  return null;
}

/**
 * Handle catalog intent: "menú", "quiero un alfajor", "tienen helado?" → catálogo.
 */
export async function handleCatalogIntent(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber, effectiveText, autoResponses } = ctx;

  const trigger = matchCatalogTrigger(effectiveText);
  if (!trigger) return null;

  // Colisión de palabras: el catálogo gatilla con "menu"/"menú", pero el menú
  // base que se crea con la instancia usa esa MISMA keyword. Si el merchant
  // tiene una auto-respuesta con keyword exacta, gana la suya: él sabe qué
  // quiere que pase. El catálogo solo entra con "catálogo", "precios",
  // "productos" o frases.
  const norm = effectiveText.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // `ctx.autoResponses` ya viene filtrado por is_active = true en la query.
  const ownMenu = (autoResponses || []).find(
    (ar) => (ar.keyword || "").trim().toLowerCase() === norm,
  );
  if (ownMenu) return null;

  const items = await query<CatalogItem>(
    "SELECT id, label, description, price_cents, active, sort_order, category, image_url FROM catalog_items WHERE instance_id = ? AND active = true ORDER BY sort_order ASC",
    [instance.id]
  );

  if (!items || items.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "📭 Por ahora no tenemos productos cargados.\n\nPronto te avisamos 😊",
      1200,
    );
    return { status: "success", matched: "[catalog empty]" };
  }

  const { menus } = buildCatalogMenus(items);
  if (menus.length === 0) return null;

  await sendMenuResponse(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, menus[0],
  );

  return { status: "success", matched: `[catálogo: ${trigger}]` };
}

/**
 * Paginación del catálogo desde texto: el cliente responde el número del
 * "Ver más" y se muestra la página siguiente.
 *
 * `menu_p<N>` para la lista plana / categorías, `catnext_<N>` para los
 * productos de una categoría.
 */
export async function handleCatalogPage(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber, effectiveText } = ctx;
  const text = (effectiveText || "").trim();
  const m = /^(?:menu_p|catnext_)(\d{1,3})$/.exec(text);
  if (!m) return null;

  const page = Number(m[1]);
  if (!Number.isFinite(page) || page < 1) return null;

  const items = await query<CatalogItem>(
    "SELECT id, label, description, price_cents, active, sort_order, category, image_url FROM catalog_items WHERE instance_id = ? AND active = true ORDER BY sort_order ASC",
    [instance.id]
  );
  if (!items?.length) return null;

  const business = await getBusinessName(instance.id, instance.instance_name);
  const isCategoryPage = text.startsWith("catnext_");

  // En `catnext_<N>` el número es la página DENTRO de la última categoría
  // elegida. Como no guardamos estado, reconstruimos la primera categoría con
  // productos: es el caso natural al encadenar productos de una misma sección.
  if (isCategoryPage) {
    const cats = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[];
    if (cats.length < 2) {
      const { menus } = buildCatalogMenus(items);
      const target = menus[page - 1];
      if (!target) return null;
      await sendMenuResponse(
        instance.evolution_api_url, instance.evolution_api_key,
        instance.instance_name, phoneNumber, target,
      );
      return { status: "success", matched: "[catálogo página]" };
    }
    const cat = cats[0];
    const sub = buildCategoryMenu(cat, items.filter((i) => i.category === cat));
    const target = sub[page - 1];
    if (!target) return null;
    await sendMenuResponse(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber, target,
    );
    return { status: "success", matched: "[catálogo página]" };
  }

  const { menus } = buildCatalogMenus(items);
  const target = menus[page - 1];
  if (!target) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      `Esa es la última página 😊\n\nElegí *${business}* con otro número o escribí *menú* para volver.`,
      1200,
    );
    return { status: "success", matched: "[catálogo fuera de rango]" };
  }

  await sendMenuResponse(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, target,
  );
  return { status: "success", matched: "[catálogo página]" };
}

/**
 * Handle selection of a catalog item → creates order and confirms.
 */
export async function handleOrderSelect(ctx: WebhookContext, itemId: string): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const items = await query<{ id: string; label: string; price_cents: number; active: boolean }>(
    "SELECT id, label, price_cents, active FROM catalog_items WHERE id = ? AND active = true",
    [itemId]
  );
  const item = items?.[0];

  if (!item) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ *Producto no disponible*. Elegí otra opción.",
      1500,
    );
    return { status: "success", matched: "[order item not found]" };
  }

  // Create order
  // `orders.id` es VARCHAR sin AUTO_INCREMENT → `insertId` siempre era 0, así
  // que el `if (insertId)` de abajo NUNCA entraba: el pedido se guardaba pero
  // el cliente nunca recibía el "✅ Pedido registrado".
  const orderId = generateId();
  await query(
    "INSERT INTO orders (id, instance_id, user_id, customer_phone, customer_name, catalog_item_id, option_label, price_cents, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())",
    [
      orderId,
      instance.id,
      null,
      phoneNumber,
      ctx.pushName || null,
      item.id,
      item.label,
      item.price_cents,
    ]
  );
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `✅ *Pedido registrado*\n\n` +
      `📦 *${item.label}*\n` +
      `💰 $${(item.price_cents / 100).toFixed(2)}\n\n` +
      `Tu pedido fue cargado. Lo estamos preparando 🚀`,
    1500,
  );

  return { status: "success", matched: "[order created]" };
}
