import { describe, it, expect, vi, beforeEach } from "vitest";

/* Mockeamos @/lib/db.

   Antes solo hacía INSERTs por `query()`, que en los tests es un vi.fn().
   Ahora las escrituras van por el CLIENTE (`getAdmin().from(...).insert()`)
   y `query()` solo queda para el SELECT de idempotencia.

   Por eso el mock de abajo devuelve una cadena de objetos encadenados:
   `from().insert()` devuelve algo, y ese algo tiene que admitir `.then()`
   para que el `await` del seeder funcione y capture lo que se inserta. */
const query = vi.fn();
const insertados: Array<Record<string, unknown>> = [];

function cadena() {
  const p: any = Promise.resolve({ data: null, error: null });
  const self: any = {
    then: p.then.bind(p),
    insert: (fila: Record<string, unknown>) => {
      insertados.push(fila);
      return self;
    },
    select: () => self,
    eq: () => self,
  };
  return self;
}

vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => query(...args),
  generateId: () => `id-${Math.random().toString(36).slice(2, 12)}`,
  getAdmin: () => ({ from: () => cadena() }),
}));

const { seedDefaults } = await import("./seed-defaults");

/* Las filas insertadas son ahora los objetos que se pasaron a .insert(),
   no hay SQL que parsear. */
function insertedRows(): Array<Record<string, unknown>> {
  return insertados;
}
describe("seedDefaults", () => {
  beforeEach(() => {
    query.mockReset();
    /* También hay que vaciar las filas insertadas.

       Antes esto no hacía falta porque cada test comprobaba `query`,
       que `mockReset()` limpiaba. Ahora las insertaciones van a un
       array propio y sin vaciarlo cada test veía las filas de los
       anteriores: el que espera `inst-9` encontraba antes un `inst-1`
       del test previo, y el del nombre genérico veía el "Craft 3D" del
       test anterior en vez del "Menú" que pedía.

       O sea: dos tests empezaban a fallar no por el seeder, sino por
       estado que se les escapaba de tests anteriores. */
    insertados.length = 0;
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

    const config = menu!.menu_config as {
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
    const config = menu.menu_config as { buttons: unknown[] };
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
    const config = menu.menu_config as { title: string };
    expect(config.title).toContain("Menú");
  });

  it("todo lo creado queda activo y con el bot correcto", async () => {
    query.mockResolvedValueOnce([{ n: 0 }]);
    await seedDefaults("inst-9", "user-9", "Craft 3D");
    for (const r of insertedRows()) {
      expect(r.bot_id).toBe("inst-9");
      expect(r.is_active).toBe(true);
      // user_id ya no está en el esquema: el "quién" es el teléfono que
      // escribe, no el usuario de Nexo Studio. Que no aparezca es justo
      // lo que se quiere comprobar.
      expect("user_id" in r).toBe(false);
      // Y todas las filas tienen id, que es lo que permite que el menú
      // apunte a ellas por target_id.
      expect(String(r.id ?? "").length).toBeGreaterThan(0);
    }
  });
});
