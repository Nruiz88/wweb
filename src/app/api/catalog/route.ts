import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isValidId } from "@/lib/validation";

export const dynamic = "force-dynamic";

/* =========================================================
   Catálogo del bot
   ---------------------------------------------------------
   Antes cada petición traía `?instanceId=` y lo comprobaba con
   `verifyUserAccess`. En PATCH y DELETE el patrón era peor: una
   consulta para leer de qué instancia era el producto, y otra para
   modificarlo que NO repetía ese filtro. Si entre ambas cosas cambiaba
   el dueño, el UPDATE tocaba el catálogo de otro.

   Ahora el bot sale de `botDeLaSesion()` (RLS) y el `bot_id` va en el
   WHERE de la propia operación: una sola llamada, y si el producto es
   de otro cliente no hay nada que actualizar.

   Todo va con el cliente de Supabase en vez de con `query()`, que va a
   `ejecutar_sql` y es de SOLO LECTURA (migración 012 del panel).
   ========================================================= */

const COLUMNAS =
  "id, label, description, price_cents, active, sort_order, category, image_url, created_at, updated_at";

/** Acepta solo http(s) y data:image/. Cualquier otra cosa se descarta. */
function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > 500) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  return null;
}

async function contexto() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) };

  const db = clienteDeLaSesion(session);
  if (!db) {
    return { error: NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 }) };
  }

  const bot = await botDeLaSesion(session);
  if (!bot) {
    return { error: NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 }) };
  }

  return { db, bot };
}

// GET /api/catalog
export async function GET() {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.db
    .from("bots_catalog_items")
    .select(COLUMNAS)
    .eq("bot_id", ctx.bot.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ status: "error", error: "No se pudo leer el catálogo" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? [] });
}

// POST /api/catalog { label, price_cents, description, category, image_url, active, sort_order }
export async function POST(request: Request) {
  const rl = await rateLimitResponse(request, "catalog-post", { maxRequests: 30 });
  if (rl) return rl;

  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { label, price_cents, description, category, image_url, active, sort_order } = body as Record<string, unknown>;

  const cleanLabel = String(label ?? "").trim();
  if (!cleanLabel) return NextResponse.json({ status: "error", error: "label required" }, { status: 400 });
  if (cleanLabel.length > 200) {
    return NextResponse.json({ status: "error", error: "label demasiado largo" }, { status: 400 });
  }

  const price = Number(price_cents);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 });
  }

  const imageUrl = normalizeImageUrl(image_url);

  /* Un `sort_order` que no es un número se trata como 0, no como error:
     el formulario siempre lo manda, y rechazar el alta del producto
     porque el orden venga vacío era más molesto que útil. */
  const orden = Number(sort_order);

  /* `category` antes se ESCAPABA del INSERT: el formulario la mandaba
     pero no se guardaba, así que todo producto nuevo salía sin
     categoría. */
  const { data, error } = await ctx.db
    .from("bots_catalog_items")
    .insert({
      bot_id: ctx.bot.id,
      label: cleanLabel,
      description: description ? String(description).trim() : null,
      price_cents: Math.round(price),
      active: active ?? true,
      sort_order: Number.isFinite(orden) ? orden : 0,
      category: category ? String(category).trim() : null,
      image_url: imageUrl,
    })
    .select("id, label, price_cents, category, image_url")
    .single();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo guardar el producto" }, { status: 500 });

  return NextResponse.json({ status: "success", data });
}

// PATCH /api/catalog { id, ...fields }
export async function PATCH(request: Request) {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body as { id?: unknown };
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  }

  /* El WHERE lleva `bot_id`, así que la pertenencia se comprueba en la
     propia operación. Con el cliente además la aplica RLS: por mucho
     que el id sea de otro bot, la política `gestionar su catalogo` no
     deja tocarlo y devuelve cero filas. */
  const updates: Record<string, unknown> = {};
  const { label, price_cents, description, category, image_url, active, sort_order } = body;

  if (label !== undefined) {
    const c = String(label).trim();
    if (!c) return NextResponse.json({ status: "error", error: "label invalid" }, { status: 400 });
    updates.label = c;
  }
  if (price_cents !== undefined) {
    const p = Number(price_cents);
    if (!Number.isFinite(p) || p < 0) {
      return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 });
    }
    updates.price_cents = Math.round(p);
  }
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (category !== undefined) updates.category = category ? String(category).trim() : null;
  if (image_url !== undefined) updates.image_url = normalizeImageUrl(image_url);
  if (active !== undefined) updates.active = !!active;
  if (sort_order !== undefined) {
    const s = Number(sort_order);
    if (!Number.isFinite(s)) {
      return NextResponse.json({ status: "error", error: "sort_order invalid" }, { status: 400 });
    }
    updates.sort_order = s;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ status: "success" });

  const { data, error } = await ctx.db
    .from("bots_catalog_items")
    .update(updates)
    .eq("id", id)
    .eq("bot_id", ctx.bot.id)
    .select("id, label, price_cents, description, category, image_url, active, sort_order")
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo actualizar" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "success", data });
}

// DELETE /api/catalog?id=xxx
export async function DELETE(request: Request) {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  }

  const { data, error } = await ctx.db
    .from("bots_catalog_items")
    .delete()
    .eq("id", id)
    .eq("bot_id", ctx.bot.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo borrar" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "success" });
}