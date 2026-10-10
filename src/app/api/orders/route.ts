import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { todayInBusinessTimezone } from "@/lib/timezone";
import { isValidId } from "@/lib/validation";

export const dynamic = "force-dynamic";

/* =========================================================
   Pedidos del bot
   ---------------------------------------------------------
   QUÉ CAMBIÓ
   --------
   Antes cada petición traía `?instanceId=` y se comprobaba con
   `verifyUserAccess(userId, instanceId)`. Ahora el bot sale de la
   sesión: `botDeLaSesion()` lo busca con el cliente que lleva el
   token del usuario, así que RLS decide y no hay id que alguien pueda
   inventar en la URL.

   Y las escrituras ya no pasan por `query()`. Esa función va a
   `ejecutar_sql`, que es de SOLO LECTURA (migración 012 en el panel):
   un UPDATE por ahí no se ejecutaría, y lo devolvía `affectedRows: 0`
   como si el pedido no existiera. Por eso el PATCH va con el cliente.

   El `IF(? = 'completed', NOW(), completed_at)` de MariaDB era un
   condicional que en Postgres no existe: `completed_at` lo pone el
   cliente cuando el estado es 'completed' y se deja como está si no.
   ========================================================= */

/** Los estados que acepta un pedido. Los mismos del CHECK de la tabla. */
const ESTADOS = ["pending", "completed", "canceled"];

/** Columnas que se devuelven. `notes` no se envía: es interno. */
const COLUMNAS = "id, customer_phone, customer_name, catalog_item_id, option_label, price_cents, status, created_at";

// GET /api/orders?date=YYYY-MM-DD|today
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  const bot = await botDeLaSesion(session);
  if (!bot) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  /* `today` se calculaba con toISOString() (UTC) contra un TIMESTAMP
     escrito con NOW() (UTC del servidor): después de las 21:00 el filtro
     mostraba el día equivocado. Se usa la zona del negocio. */
  const dia = date === "today" ? todayInBusinessTimezone() : date;

  /* Se consulta por el cliente con RLS, no por `query()`. Aunque
     `bot.id` ya viene filtrado, usar el cliente aquí es la segunda
     barrera y no cuesta nada. */
  let q = db
    .from("bots_orders")
    .select(COLUMNAS)
    .eq("bot_id", bot.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (dia) {
    /* `fecha` en vez de created_at: comparar una timestamptz contra
       "YYYY-MM-DD" en Postgres hace un cast implícito que puede
     descolocar el filtro por zona. El rango va explícito. */
    q = q.gte("created_at", `${dia}T00:00:00`).lte("created_at", `${dia}T23:59:59.999`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", error: "No se pudieron leer los pedidos" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? [] });
}

// PATCH /api/orders { id, status }
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  }
  if (typeof status !== "string" || !ESTADOS.includes(status)) {
    return NextResponse.json({ status: "error", error: "status invalid" }, { status: 400 });
  }

  /* El filtro por `bot_id` ES la comprobación de pertenencia.

     Antes era una consulta aparte con un `IN (SELECT ... UNION SELECT
     ...)` para comprobar de quién era el pedido, y luego un UPDATE
     aparte que no repetía ese filtro: si entre las dos cosas cambiaba
     algo, el UPDATE tocaba el pedido de otro. Aquí es una sola
     operación y el `bot_id` va en el WHERE. */
  const { data, error } = await db
    .from("bots_orders")
    .update({
      status,
      /* `completed_at` solo se rellena al completar, y NO se borra al
         reabrir: es el registro de cuándo se cobró. Antes el
         condicional `IF()` de MariaDB no distinguía esos dos casos. */
      ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .eq("bot_id", (await botDeLaSesion(session))?.id ?? "")
    .select("id, status, completed_at")
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo actualizar" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  return NextResponse.json({ status: "success", data });
}