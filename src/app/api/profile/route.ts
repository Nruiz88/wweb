import { NextResponse } from "next/server";
import { getSession, clienteDeLaSesion, botDeLaSesion } from "@/lib/sesion";
import { MI_CUENTA } from "@/lib/panel";

export const dynamic = "force-dynamic";

/* =========================================================
   Perfil del cliente
   ---------------------------------------------------------
   QUÉ DESAPARECIÓ Y POR QUÉ
   --------------------------
   Antes esta ruta devolvía el `profiles` del bot con `business_name`,
   `phone` y `address`, más su `subscription` con `plan_type`,
   `max_instances`, `used_instances` y `addons`, y hacía un `user_
   instances` para contar instancias.

   Todo eso es de Nexo Studio, no del bot:
     · el nombre y el email del cliente están en `profiles`/`clients`
       del panel, y su ficha en `fichas`
     · la suscripción está en `suscripciones`, con `tiene_modulo()`
     · los "bots extra" (instance_addons) no existen todavía

   Editar aquí duplicaría datos que el panel ya tiene, y el cliente
   acabaría con dos sitios donde corregir su nombre. Por eso esta ruta
   SOLO LEE, y de lo que el bot necesita para mostrarse.

   Lo que sí se queda: las próximas citas, que son del bot.
   ========================================================= */

/** Columnas de `clients`, que es de donde sale el nombre real. */
const COLUMNAS_CLIENTE = "id, nombre, email";

// GET /api/profile
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  /* Se usa el cliente de la sesión (RLS) para leer datos del cliente.
     RLS deja leer al cliente su propia fila de `clients`; si no
     cuadra, se cae al nombre de la sesión, que siempre existe. */
  const db = clienteDeLaSesion(session);

  let nombre = "";
  let email = "";

  if (db) {
    const { data } = await db
      .from("clients")
      .select(COLUMNAS_CLIENTE)
      .eq("id", session.clientId)
      .maybeSingle();
    nombre = data?.nombre ?? "";
    email = data?.email ?? "";
  }

  /* Próximas citas de los próximos 14 días.

     Sin `db` no se puede consultar nada: el access_token de la sesión
     caducó y hay que volver al panel. Antes esto habría petado con
     "Cannot read properties of null" y un 500 sin explicar nada. */
  let upcoming: Array<{ date: string; time: string; name: string | null }> = [];
  let slug = "";

  if (db) {
    const { data: citas } = await db
      .from("bots_appointments")
      .select("appointment_date, appointment_time, customer_name")
      .in("status", ["pending", "confirmed"])
      .gte("appointment_date", hoy())
      .lte("appointment_date", enDias(14))
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(5);

    upcoming = (citas ?? []).map((a) => ({
      date: a.appointment_date,
      time: a.appointment_time,
      name: a.customer_name || null,
    }));
  }

  /* El slug del bot, para el enlace público de la agenda.

     Esto se añade porque la página de perfil se inventaba el slug con
     `slugify(nombre del negocio) || slugify(email)`. El slug que
     `/api/public/agenda` busca es el de la fila de `bots`, y no tiene
     por qué coincidir: puede haberlo creado el panel, venir de una
     importación, o tener un sufijo por colisión. El resultado era un
     enlace que se copiaba y repartía a los clientes, y que al abrirlo
     respondía 404.

     El slug sale del bot de la sesión, con RLS: es el suyo y solo el
     suyo. Si no tiene bot, se devuelve vacío y la página no muestra un
     enlace inventado. */
  const bot = await botDeLaSesion(session);
  slug = bot?.slug ?? "";

  return NextResponse.json({
    status: "success",
    data: {
      id: session.userId,
      client_id: session.clientId,
      nombre,
      email,
      slug,
      /* El plan no se devuelve porque el bot no lo conoce ni lo
         necesita: entrar ya exige tener el módulo contratado, que es
         lo que hacía este bloque. */
      upcoming,
    },
  });
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function enDias(dias: number): string {
  return new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// PUT /api/profile
//
// Ya no existe. Antes actualizaba `business_name`, `phone` y `address`
// del perfil del bot. Esos datos viven en la ficha del negocio que
// gestiona el panel de Nexo Studio (migración 010), y editarlos aquí
// crearía dos fuentes de verdad para el mismo dato.
//
// Responder 405 con dónde hacerlo es mejor que un 200 que finge que
// se guardó: el cliente vería el cambio hasta que recargara.
export async function PUT() {
  return NextResponse.json(
    {
      status: "error",
      error:
        "Los datos del negocio se editan en el panel de Nexo Studio, no aquí.",
      donde: MI_CUENTA,
    },
    { status: 405 }
  );
}