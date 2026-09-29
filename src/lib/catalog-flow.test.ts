import { describe, it, expect } from "vitest";
import { buildCatalogMenus, buildCategoryMenu, matchCatalogTrigger } from "./webhook/catalog";
import type { CatalogItem } from "@/lib/db/types";

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
    image_url: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("buildCatalogMenus", () => {
  it("catálogo vacío → sin menús", () => {
    const { menus, entryMenuId } = buildCatalogMenus([]);
    expect(menus).toEqual([]);
    expect(entryMenuId).toBe("");
  });

  it("1 producto → 1 página, sin navegación", () => {
    const { menus } = buildCatalogMenus([item({ id: "a", label: "B/N", price_cents: 1200 })]);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons).toHaveLength(1);
    expect(menus[0].buttons[0].text).toBe("B/N — $12");
    expect(menus[0].buttons[0].target_id).toBe("order_a");
    expect(menus[0].title).toBe("Nuestro catálogo — pág 1/1");
  });

  it("precio con centavos se muestra con 2 decimales", () => {
    const { menus } = buildCatalogMenus([item({ id: "a", price_cents: 1550 })]);
    expect(menus[0].buttons[0].text).toContain("$15.50");
  });

  it("todos los productos caben en una página (antes topaban en 2)", () => {
    // Este era el bug: con 4 productos el 4º era inalcanzable desde el chat.
    const items = ["a", "b", "c", "d"].map((id, i) => item({ id, sort_order: i }));
    const { menus } = buildCatalogMenus(items);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons).toHaveLength(4);
    expect(menus[0].buttons.every((b) => b.target_id?.startsWith("order_"))).toBe(true);
  });

  it("con más de 8 aparece 'Ver más' y pagina", () => {
    const items = Array.from({ length: 10 }, (_, i) => item({ id: `id${i}`, sort_order: i }));
    const { menus } = buildCatalogMenus(items);
    expect(menus).toHaveLength(2);
    // página 1: 8 productos + Ver más
    expect(menus[0].buttons).toHaveLength(9);
    expect(menus[0].buttons[8].text).toBe("➡️ Ver más");
    expect(menus[0].buttons[8].target_id).toBe("menu_p2");
    // página 2: los 2 restantes, sin navegación
    expect(menus[1].buttons).toHaveLength(2);
    expect(menus[1].title).toBe("Nuestro catálogo — pág 2/2");
  });

  it("20 productos → 3 páginas de 8/8/4", () => {
    const items = Array.from({ length: 20 }, (_, i) => item({ id: `id${i}`, sort_order: i }));
    const { menus } = buildCatalogMenus(items);
    expect(menus).toHaveLength(3);
    expect(menus.map((m) => m.buttons.length)).toEqual([9, 9, 4]);
  });

  it("con 2+ categorías, la primera pantalla muestra las categorías", () => {
    const items = [
      item({ id: "a", category: "Bebidas", sort_order: 0 }),
      item({ id: "b", category: "Comidas", sort_order: 1 }),
      item({ id: "c", category: "Bebidas", sort_order: 2 }),
    ];
    const { menus } = buildCatalogMenus(items);
    expect(menus).toHaveLength(1);
    expect(menus[0].buttons.map((b) => b.text)).toEqual(["📂 Bebidas", "📂 Comidas"]);
    expect(menus[0].buttons[0].target_id).toBe("cat_sub_Bebidas");
  });

  it("con una sola categoría (o ninguna) lista productos directo", () => {
    const items = [
      item({ id: "a", category: "Bebidas", sort_order: 0 }),
      item({ id: "b", category: "Bebidas", sort_order: 1 }),
    ];
    const { menus } = buildCatalogMenus(items);
    expect(menus[0].buttons[0].target_id).toBe("order_a");
  });

  it("productos pausados no aparecen", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "a", label: "Activo", sort_order: 0 }),
      item({ id: "b", label: "Pausado", active: false, sort_order: 1 }),
    ]);
    expect(menus[0].buttons).toHaveLength(1);
    expect(menus[0].buttons[0].text).toContain("Activo");
  });

  it("respeta sort_order", () => {
    const { menus } = buildCatalogMenus([
      item({ id: "b", label: "B", sort_order: 5 }),
      item({ id: "a", label: "A", sort_order: 1 }),
    ]);
    expect(menus[0].buttons[0].text).toContain("A");
    expect(menus[0].buttons[1].text).toContain("B");
  });
});

describe("buildCategoryMenu", () => {
  it("lista los productos de la categoría con paginación", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      item({ id: `id${i}`, category: "Bebidas", sort_order: i }),
    );
    const menus = buildCategoryMenu("Bebidas", items);
    expect(menus).toHaveLength(2);
    expect(menus[0].buttons[8].target_id).toBe("catnext_2");
    expect(menus[0].title).toBe("Bebidas — pág 1/2");
  });
});

describe("matchCatalogTrigger", () => {
  // Antes era coincidencia EXACTA contra una lista corta: "hola, tenés
  // alfajores?" no disparaba nada.
  it.each([
    ["menú", true],
    ["menu", true],
    ["la carta por favor", true],
    ["catalogo", true],
    ["catálogo", true],
    ["quiero un alfajor", true],
    ["hola, tenés alfajores?", true],
    ["quisiera ver los precios", true],
    ["quiero hacer un pedido", true],
    ["venden alfajores?", true],
    ["hola", false],
    ["turno", false],
    ["", false],
  ])("%s → %s", (texto, esperado) => {
    const r = matchCatalogTrigger(texto as string);
    if (esperado) {
      expect(typeof r).toBe("string");
      expect((r as string).length).toBeGreaterThan(0);
    } else {
      expect(r).toBeNull();
    }
  });
});
