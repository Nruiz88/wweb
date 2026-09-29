import { describe, it, expect } from "vitest";
import { parsePriceList, parsePriceToCents, formatCents } from "./price-list";

describe("parsePriceToCents", () => {
  it("número simple", () => {
    expect(parsePriceToCents("1200")).toBe(120000);
    expect(parsePriceToCents("$3500")).toBe(350000);
  });

  it("formato argentino: punto de miles y coma decimal", () => {
    expect(parsePriceToCents("1.200")).toBe(120000);
    expect(parsePriceToCents("1.200,50")).toBe(120050);
    expect(parsePriceToCents("$1.234.567,89")).toBe(123456789);
  });

  it("decimal con coma", () => {
    expect(parsePriceToCents("850,5")).toBe(85050);
  });

  it("un solo punto con 3 dígitos = miles (es lo que escribe un argentino)", () => {
    expect(parsePriceToCents("2.500")).toBe(250000);
  });

  it("rechaza basura", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNull();
    expect(parsePriceToCents("-50")).toBeNull();
  });
});

describe("parsePriceList", () => {
  it("lista básica con distintos separadores", () => {
    const { products } = parsePriceList(`
Alfajor de chocolate - 1200
Café con leche $1.200,50
Empanada de carne: 3500
Bolo de queso —— 2.500
`);
    expect(products).toHaveLength(4);
    expect(products[0]).toMatchObject({ label: "Alfajor de chocolate", priceCents: 120000 });
    expect(products[1]).toMatchObject({ label: "Café con leche", priceCents: 120050 });
    expect(products[2]).toMatchObject({ label: "Empanada de carne", priceCents: 350000 });
    expect(products[3]).toMatchObject({ label: "Bolo de queso", priceCents: 250000 });
  });

  it("quita marcadores de lista y respeta el orden", () => {
    const { products } = parsePriceList(`
- Uno 100
* Dos 200
• Tres 300
1. Cuatro 400
2) Cinco 500
`);
    expect(products.map((p) => p.label)).toEqual(["Uno", "Dos", "Tres", "Cuatro", "Cinco"]);
    expect(products.map((p) => p.priceCents)).toEqual([10000, 20000, 30000, 40000, 50000]);
  });

  it("NO confunde el tamaño del envase con el precio", () => {
    // "500ml" no puede terminar en precio porque tiene letras después.
    const { products, rejected } = parsePriceList("Agua mineral 500ml 800");
    expect(products).toHaveLength(1);
    expect(products[0].label).toBe("Agua mineral 500ml");
    expect(products[0].priceCents).toBe(80000);
  });

  it("rechaza una línea sin precio y lo explica", () => {
    const { products, rejected } = parsePriceList(`
Alfajor 1200
Consulta por precios al local
`);
    expect(products).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].raw).toBe("Consulta por precios al local");
    expect(rejected[0].reason).toMatch(/precio/i);
    expect(rejected[0].line).toBe(3);
  });

  it("rechaza precio $0", () => {
    const { products, rejected } = parsePriceList("Producto gratis 0");
    expect(products).toHaveLength(0);
    expect(rejected[0].reason).toMatch(/\$0/);
  });

  it("rechaza una línea que es solo un número", () => {
    const { products, rejected } = parsePriceList("1200");
    expect(products).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it("ignora separadores y encabezados", () => {
    const { products, rejected } = parsePriceList(`
PRODUCTO          PRECIO
─────────────────────────
Alfajor 1200
Café 2500
`);
    expect(products).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it("detecta categorías con pipe", () => {
    const { products } = parsePriceList(`
Café con leche | Bebidas | 2500
Alfajor | Dulces | 1200
`);
    expect(products[0]).toMatchObject({ label: "Café con leche", category: "Bebidas", priceCents: 250000 });
    expect(products[1]).toMatchObject({ label: "Alfajor", category: "Dulces", priceCents: 120000 });
  });

  it("detecta categorías con paréntesis", () => {
    const { products } = parsePriceList("Alfajor (Dulces) - 1200");
    expect(products[0]).toMatchObject({ label: "Alfajor", category: "Dulces", priceCents: 120000 });
  });

  it("usa la categoría por defecto cuando la línea no trae", () => {
    const { products } = parsePriceList("Alfajor - 1200\nCafé - 2500", "Comidas");
    expect(products.every((p) => p.category === "Comidas")).toBe(true);
  });

  it("líneas en blanco no cuentan como rechazadas", () => {
    const { rejected } = parsePriceList("\n\n\nAlfajor 1200\n\n\n");
    expect(rejected).toHaveLength(0);
  });

  it("detecta duplicados por nombre normalizado", () => {
    const { products } = parsePriceList("Alfajor de chocolate - 1200\nalfajor de chocolate - 1200");
    expect(products).toHaveLength(2);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(norm(products[0].label)).toBe(norm(products[1].label));
  });

  it("preserva el texto original para que el merchant lo reconozca", () => {
    const { products } = parsePriceList("  * Alfajor de chocolate - $1.200  ");
    expect(products[0].raw).toBe("* Alfajor de chocolate - $1.200");
    expect(products[0].line).toBe(1);
  });
});

describe("formatCents", () => {
  it("formatea a pesos legibles", () => {
    expect(formatCents(120000)).toBe("$1.200");
    expect(formatCents(120050)).toBe("$1.200,50");
    expect(formatCents(80000)).toBe("$800");
  });
});
