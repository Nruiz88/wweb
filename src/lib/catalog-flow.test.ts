import { describe, it, expect } from "vitest";
import { buildCatalogMenus } from "./webhook/catalog";
import type { CatalogItem } from "./supabase/types";

function item(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    id: "x",
    instance_id: "i",
    label: "Producto",
    description: null,
    price_cents: 1000,
    active: true,
    sort_order: 0,
    category: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("buildCatalogMenus", () => {
  it("empty catalog → no menus", () => {
    const { menus, entryMenuId } = buildCatalogMenus([]);
    expect(menus).toEqual([]);
    expect(entryMenuId).toBe("");
  });

  it("1 item → 1 page, 1 button, no nav", () => {
    const { menus } = buildCatalogMenus([item({ id: "a", label: "B/N", price_cents: 1200, sort_order: 0 })]);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons).toHaveLength(1);
    expect(menus[0].buttons[0].text).toBe("B/N — $12");
    expect(menus[0].buttons[0].target_id).toBe("order_a");
    expect(menus[0].title).toBe("Catálogo — pág 1/1");
  });

  it("2 items → 1 page, 2 buttons, no nav", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "a", label: "B/N", price_cents: 1200, sort_order: 0 }),
      item({ id: "b", label: "Color", price_cents: 3500, sort_order: 1 }),
    ]);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons).toHaveLength(2);
    expect(menus[0].title).toBe("Catálogo — pág 1/1");
  });

  it("3 items → 2 pages: page1 has 2 items + Ver más, page2 has 1 item no nav", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "a", label: "B/N", price_cents: 1200, sort_order: 0 }),
      item({ id: "b", label: "Color", price_cents: 3500, sort_order: 1 }),
      item({ id: "c", label: "Anillado", price_cents: 2000, sort_order: 2 }),
    ]);
    expect(menus).toHaveLength(2);
    expect(menus[0].buttons).toHaveLength(3); // 2 items + Ver más
    expect(menus[0].buttons[2].text).toBe("Ver más →");
    expect(menus[0].buttons[2].target_id).toBe("menu_p2");
    expect(menus[1].buttons).toHaveLength(1); // last page, no nav
    expect(menus[1].title).toBe("Catálogo — pág 2/2");
  });

  it("12 items → 6 pages", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item({ id: `id${i}`, label: `Producto ${i + 1}`, price_cents: 1000 * (i + 1), sort_order: i }),
    );
    const { menus } = buildCatalogMenus(items);
    expect(menus).toHaveLength(6);
    menus.forEach((m, i) => {
      expect(m.title).toBe(`Catálogo — pág ${i + 1}/6`);
    });
    // Pages 1-5 have 3 buttons (2 items + Ver más)
    for (let i = 0; i < 5; i++) {
      expect(menus[i].buttons).toHaveLength(3);
      expect(menus[i].buttons[2].text).toBe("Ver más →");
      expect(menus[i].buttons[2].target_id).toBe(`menu_p${i + 2}`);
    }
    // Last page has 2 buttons (no nav)
    expect(menus[5].buttons).toHaveLength(2);
  });

  it("inactive items excluded", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "a", label: "Activo", active: true, sort_order: 0 }),
      item({ id: "b", label: "Pausado", active: false, sort_order: 1 }),
    ]);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons).toHaveLength(1);
    expect(menus[0].buttons[0].text).toContain("Activo");
  });

  it("sorted by sort_order", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "b", label: "B", sort_order: 5 }),
      item({ id: "a", label: "A", sort_order: 1 }),
    ]);
    expect(menus[0].buttons[0].text).toContain("A");
    expect(menus[0].buttons[1].text).toContain("B");
  });
});
