import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockeamos @/lib/db: el seeder solo hace INSERTs, y sin MARIADB_URL el pool
// es null en los tests.
const query = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => query(...args),
  generateId: () => `id-${Math.random().toString(36).slice(2, 12)}`,
}));

const { seedDefaults } = await import("./seed-defaults");

function insertedRows(): Array<Record<string, unknown>> {
  return query.mock.calls
    .filter((c) => String(c[0]).trim().toUpperCase().startsWith("INSERT"))
    .map((c) => {
      const sql = String(c[0]);
      // La lista de columnas es el ÚLTIMO grupoParentheses antes de VALUES.
      // Usar indexOf("(") engancha el de "auto_responses(" y rompe todo.
      const m = /\(([^()]*)\)\s*VALUES/i.exec(sql);
      const cols = m ? m[1].split(",").map((s) => s.trim()) : [];
      const vals = (c[1] ?? []) as unknown[];
      const row: Record<string, unknown> = {};
      cols.forEach((col, i) => { row[col] = vals[i]; });
      return row;
    });
}

describe("seedDefaults", () => {
  beforeEach(() => {
    query.mockReset();
  });

  it("crea respuestas base y un menú", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]); // count = 0 → no existe
    const r = await seedDefaults("inst-1", "user-1", "Craft 3D");
    expect(r.skipped).toBe(false);
    expect(r.created).toBeGreaterThan(0);
  });

  it("es idempotente: si ya hay respuestas, no toca nada", async () => {
    query.mockResolvedValueOnce([{ n: 5 }]); // count = 5 → ya hay
    const r = await seedDefaults("inst-1", "user-1", "Craft 3D");
    expect(r.skipped).toBe(true);
    expect(r.created).toBe(0);
    // Solo la consulta de conteo, ningún INSERT.
    expect(query.mock.calls.filter((c) => String(c[0]).includes("INSERT"))).toHaveLength(0);
  });

  it("el menú base apunta a respuestas que se crearon en el mismo lote", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-1", "user-1", "Craft 3D");
    const rows = insertedRows();

    const menu = rows.find((r) => r.response_type === "menu");
    expect(menu).toBeDefined();
    expect(menu!.keyword).toBe("menu");

    const config = JSON.parse(menu!.menu_config as string) as {
      title: string;
      buttons: Array<{ text: string; target_id: string }>;
    };
    expect(config.title).toContain("Craft 3D");
    expect(config.buttons.length).toBeGreaterThanOrEqual(3);

    // Cada target_id tiene que existir entre las filas insertadas.
    const createdIds = new Set(rows.map((r) => r.id as string));
    for (const b of config.buttons) {
      expect(createdIds.has(b.target_id)).toBe(true);
    }
  });

  it("el menú tiene 3 opciones como máximo (límite de WhatsApp)", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-1", "user-1", "Craft 3D");
    const menu = insertedRows().find((r) => r.response_type === "menu")!;
    const config = JSON.parse(menu.menu_config as string) as { buttons: unknown[] };
    expect(config.buttons.length).toBeLessThanOrEqual(3);
  });

  it("todas las keywords son distintas entre sí", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    const r = await seedDefaults("inst-1", "user-1", "Craft 3D");
    expect(new Set(r.responses).size).toBe(r.responses.length);
  });

  it("respeta el CHECK keyword o regex: todas tienen keyword", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-1", "user-1", "Craft 3D");
    for (const r of insertedRows()) {
      expect(String(r.keyword ?? "").length).toBeGreaterThan(0);
    }
  });

  it("respeta response_text NOT NULL: ningún texto vacío", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-1", "user-1", "Craft 3D");
    for (const r of insertedRows()) {
      expect(String(r.response_text ?? "").length).toBeGreaterThan(0);
    }
  });

  it("cae a un nombre genérico si el negocio no tiene business_name", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-1", "user-1", "");
    const menu = insertedRows().find((r) => r.response_type === "menu")!;
    const config = JSON.parse(menu.menu_config as string) as { title: string };
    expect(config.title).toContain("Menú");
  });

  it("todo lo creado queda activo y con el instance/user correctos", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-9", "user-9", "Craft 3D");
    for (const r of insertedRows()) {
      expect(r.instance_id).toBe("inst-9");
      expect(r.user_id).toBe("user-9");
      expect(r.is_active).toBe(true);
    }
  });
});
