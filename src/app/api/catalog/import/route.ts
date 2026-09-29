import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, generateId } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { verifyUserAccess } from "@/lib/api-helpers";
import { isValidId } from "@/lib/validation";
import { parsePriceList } from "@/lib/price-list";

export const dynamic = "force-dynamic";

const MAX_LINES = 1000;
const MAX_NAME = 255;

/** Normaliza un nombre para comparar duplicados: "Alfajor  de CHOCOLATE!" === "alfajor de chocolate". */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Importación masiva del catálogo desde una lista de precios pegada.
 *
 * Flujo en dos pasos desde la UI:
 *  1. El cliente parsea en el browser y le muestra al merchant una VISTA
 *     PREVIA de lo que se va a crear. El merchant edita o saca lo que no
 *     quiera. Importarlo sin mostrar nada sería la forma rápida de que alguien
 *     suba 40 productos y después descubra que la mitad están mal.
 *  2. Con lo que quedó, POSTea `{ instanceId, items }` y se crea.
 *
 * `dryRun` (por defecto true) solo analiza y devuelve el plan sin escribir.
 */
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "catalog-import", { maxRequests: 20, windowMs: 5 * 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { instanceId, text, items, defaultCategory, replaceAll } = body as {
    instanceId?: unknown;
    text?: unknown;
    items?: unknown;
    defaultCategory?: unknown;
    replaceAll?: unknown;
  };

  if (typeof instanceId !== "string" || !isValidId(instanceId)) {
    return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });
  }
  if (!(await verifyUserAccess(session.userId, instanceId))) {
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  // ── Camino 1: pegar texto (dry run) ───────────────────────────────────
  if (typeof text === "string") {
    if (text.length > 200_000) {
      return NextResponse.json({ status: "error", error: "La lista es demasiado larga" }, { status: 400 });
    }
    const cat = typeof defaultCategory === "string" ? defaultCategory.trim() || null : null;
    const { products, rejected } = parsePriceList(text, cat);

    if (products.length > MAX_LINES) {
      return NextResponse.json(
        { status: "error", error: `Máximo ${MAX_LINES} productos por importación` },
        { status: 400 }
      );
    }

    // Qué productos YA existen con ese nombre, para avisar antes de escribir.
    const existing = await query<{ label: string }>(
      "SELECT label FROM catalog_items WHERE instance_id = ?",
      [instanceId]
    );
    const existingSet = new Set(existing.map((e) => normalizeName(e.label)));

    const planned = products.map((p) => ({
      label: p.label,
      price_cents: p.priceCents,
      category: p.category,
      raw: p.raw,
      line: p.line,
      duplicate: existingSet.has(normalizeName(p.label)),
    }));

    return NextResponse.json({
      status: "success",
      data: {
        dryRun: true,
        created: planned.filter((p) => !p.duplicate).length,
        duplicates: planned.filter((p) => p.duplicate).length,
        items: planned,
        rejected,
      },
    });
  }

  // ── Camino 2: confirmar la importación ────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ status: "error", error: "items requerido" }, { status: 400 });
  }
  if (items.length > MAX_LINES) {
    return NextResponse.json(
      { status: "error", error: `Máximo ${MAX_LINES} productos por importación` },
      { status: 400 }
    );
  }

  // Validación estricta: el cliente pudo editar la vista previa, así que no
  // alcanza con confiarle los valores.
  const clean: { label: string; price_cents: number; category: string | null }[] = [];
  const skipped: Array<{ label: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const it = raw as { label?: unknown; price_cents?: unknown; category?: unknown };
    const label = typeof it.label === "string" ? it.label.trim().slice(0, MAX_NAME) : "";
    if (!label) { skipped.push({ label: String(it.label ?? "?"), reason: "sin nombre" }); continue; }

    const price = Math.round(Number(it.price_cents));
    if (!Number.isFinite(price) || price < 0) {
      skipped.push({ label, reason: "precio inválido" });
      continue;
    }
    // Tope de sanity: un blunder de formato no debería crear un producto de
    // 3 millones de pesos.
    if (price > 100_000_000) {
      skipped.push({ label, reason: "precio fuera de rango" });
      continue;
    }

    const key = normalizeName(label);
    if (seen.has(key)) { skipped.push({ label, reason: "duplicado en la misma importación" }); continue; }
    seen.add(key);

    const category = typeof it.category === "string" ? it.category.trim().slice(0, MAX_NAME) || null : null;
    clean.push({ label, price_cents: price, category });
  }

  if (clean.length === 0) {
    return NextResponse.json(
      { status: "error", error: "No hay productos válidos para importar", skipped },
      { status: 400 }
    );
  }

  const startSort = await query<{ n: number }>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM catalog_items WHERE instance_id = ?",
    [instanceId]
  );
  let sort = Number(startSort?.[0]?.n ?? 0);

  if (replaceAll === true) {
    // "Reemplazar todo": desactiva en vez de borrar, así el merchant puede
    // recuperar con un clic. Borrar de verdad sería irreversible y no vale la
    // pena para una carga masiva.
    await query("UPDATE catalog_items SET active = false, updated_at = NOW() WHERE instance_id = ? AND active = true", [instanceId]);
  }

  const inserted: string[] = [];
  const failed: string[] = [];
  for (const item of clean) {
    try {
      const id = generateId();
      await query(
        `INSERT INTO catalog_items (id, instance_id, label, price_cents, active, sort_order, category, created_at, updated_at)
         VALUES (?, ?, ?, ?, true, ?, ?, NOW(), NOW())`,
        [id, instanceId, item.label, item.price_cents, sort++, item.category]
      );
      inserted.push(item.label);
    } catch (e) {
      failed.push(item.label);
      console.error("[catalog-import] fallo al insertar", {
        label: item.label,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      dryRun: false,
      imported: inserted.length,
      inserted,
      failed,
      skipped,
      desactivated: replaceAll === true,
    },
  });
}
