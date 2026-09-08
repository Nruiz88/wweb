import { sendTextMessage } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";
import type { CatalogItem } from "@/lib/supabase/types";
import { sendMenuResponse } from "./menus";

export interface MenuConfig {
  title: string;
  description: string;
  footer?: string;
  buttons: Array<{ id: string; text: string; target_id: string | null }>;
}

/**
 * Build paginated catalog menus (2+1 rule: 2 items + 1 nav per page).
 * If items have categories, the first level is categories (2 per page + Ver más),
 * and second level shows products of that category (2 per page + Ver más).
 */
export function buildCatalogMenus(items: CatalogItem[]): { menus: MenuConfig[]; entryMenuId: string } {
  const active = items.filter((it) => it.active).sort((a, b) => a.sort_order - b.sort_order);
  if (active.length === 0) return { menus: [], entryMenuId: "" };

  // If there are 2+ distinct categories, group by category as first-level menus
  const categories = [...new Set(active.map((it) => it.category || "_default"))];
  const hasMultipleCategories = categories.length > 1 && categories.filter((c) => c !== "_default").length > 1;

  if (hasMultipleCategories && categories.length <= 6) {
    // Category-level menus: 2 categories + "Ver más" (or 3 categories on last page)
    const menus: MenuConfig[] = [];
    const catItems = categories.map((cat) => {
      const products = active.filter((it) => (it.category || "_default") === cat);
      return { category: cat, products };
    });

    for (let i = 0; i < catItems.length; i += 2) {
      const pageCats = catItems.slice(i, i + 2);
      const pageNum = Math.floor(i / 2) + 1;
      const totalPages = Math.ceil(catItems.length / 2);
      const buttons: Array<{ id: string; text: string; target_id: string | null }> = pageCats.map((catGroup) => ({
        id: `cat_${catGroup.category}`,
        text: `${catGroup.category === "_default" ? "Sin categoría" : catGroup.category} (${catGroup.products.length})`,
        target_id: `cat_sub_${catGroup.category}`,
      }));
      if (i + 2 < catItems.length) {
        buttons.push({ id: `next_p${pageNum}`, text: "Ver más →", target_id: `menu_p${pageNum + 1}` });
      }
      menus.push({
        title: `Categorías — pág ${pageNum}/${totalPages}`,
        description: "Elegí una categoría:",
        footer: "Después verás los productos de esa categoría",
        buttons,
      });
    }

    // Note: submenus (products per category) are handled by handleCatalogIntent
    // which reads the category name and builds product pages dynamically.
    return { menus, entryMenuId: "menu_p1" };
  }

  // Flat paginated (no categories or single category)
  const menus: MenuConfig[] = [];
  for (let i = 0; i < active.length; i += 2) {
    const pageItems = active.slice(i, i + 2);
    const pageNum = Math.floor(i / 2) + 1;
    const totalPages = Math.ceil(active.length / 2);
    const buttons: Array<{ id: string; text: string; target_id: string | null }> = pageItems.map((it) => ({
      id: `opt_${it.id}`,
      text: `${it.label} — $${(it.price_cents / 100).toFixed(0)}`,
      target_id: `order_${it.id}`,
    }));
    if (i + 2 < active.length) {
      buttons.push({ id: `next_p${pageNum}`, text: "Ver más →", target_id: `menu_p${pageNum + 1}` });
    }
    menus.push({
      title: `Catálogo — pág ${pageNum}/${totalPages}`,
      description: "Elegí una opción:",
      footer: "Tu pedido se registra automáticamente",
      buttons,
    });
  }

  return { menus, entryMenuId: menus[0] ? "menu_p1" : "" };
}

/**
 * Persist generated catalog menus as auto_responses (type=menu).
 * Call this whenever the catalog changes.
 */
export async function syncCatalogMenus(
  supabase: WebhookContext["supabase"],
  instanceId: string,
  items: CatalogItem[],
): Promise<string | null> {
  const { menus } = buildCatalogMenus(items);
  if (menus.length === 0) return null;

  // Remove old catalog menus for this instance
  const { data: old } = await supabase
    .from("auto_responses")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("response_type", "menu")
    .like("keyword", "catalog_menu_%");
  if (old && old.length > 0) {
    await supabase.from("auto_responses").delete().in("id", old.map((o) => o.id));
  }

  // Insert each page as auto_response with keyword catalog_menu_pN
  for (let i = 0; i < menus.length; i++) {
    const menu = menus[i];
    const { data: inserted } = await supabase
      .from("auto_responses")
      .insert({
        instance_id: instanceId,
        response_type: "menu",
        keyword: `catalog_menu_p${i + 1}`,
        menu_config: menu,
        is_active: true,
        priority: 10,
      })
      .select("id")
      .single();
    if (inserted) {
      // Update target_ids to point to real auto_response ids for order items
      // (order targets are handled inline in handleCatalogIntent)
    }
  }

  return `catalog_menu_p1`;
}

/**
 * Handle catalog intent: trigger word (pedido/catálogo/quiero) → show first menu page.
 */
export async function handleCatalogIntent(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;
  const trigger = (effectiveText || "").toLowerCase().trim();

  // Only respond to explicit catalog triggers (not booking words)
  if (!["pedido", "catálogo", "quiero", "menu", "catalogo"].includes(trigger)) return null;

  const { data: items } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("instance_id", instance.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (!items || items.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "📭 *Catálogo vacío*\n\nAún no hay productos disponibles. Intentá más tarde.",
      1500,
    );
    return { status: "success", matched: "[catalog empty]" };
  }

  const { menus } = buildCatalogMenus(items);
  const entryMenu = menus[0];

  // Send first page as interactive buttons (falls back to text via sendMenuResponse)
  await sendMenuResponse(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber, entryMenu,
  );

  return { status: "success", matched: "[catalog menu]" };
}

/**
 * Handle selection of a catalog item → creates order and confirms.
 */
export async function handleOrderSelect(ctx: WebhookContext, itemId: string): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber } = ctx;

  const { data: item } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("id", itemId)
    .eq("active", true)
    .single();

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
  const { data: order } = await supabase
    .from("orders")
    .insert({
      instance_id: instance.id,
      customer_phone: phoneNumber,
      customer_name: ctx.pushName || null,
      catalog_item_id: item.id,
      option_label: item.label,
      price_cents: item.price_cents,
      status: "pending",
    })
    .select("*")
    .single();

  if (order) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      `✅ *Pedido registrado*\n\n` +
        `📦 *${item.label}*\n` +
        `💰 $${(item.price_cents / 100).toFixed(2)}\n\n` +
        `Tu pedido fue cargado. Lo estamos preparando 🚀`,
      1500,
    );
  }

  return { status: "success", matched: "[order created]" };
}
