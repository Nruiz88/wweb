import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { getConnectionState } from "@/lib/evolution-multi";
import { getAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

/* =========================================================
   Estado del bot
   ---------------------------------------------------------
   ESTA RUTA ANTES HACÍA TRES COSAS, Y AHORA SOLO UNA
   ----------------------------------------------
   Antes: listar instancias, CREARLAS (POST) y BORRARLAS (DELETE),
   cada una con su propia conexión a Evolution (url + clave).

   Ahora solo lista. Y no es que se haya hecho la vista gorda:

   · El cliente no puede crear su bot. `bots` no tiene política de
     INSERT ni de DELETE a propósito (migración 011 del panel): el alta
     la hace el equipo de Nexo Studio, porque crear una conexión
     significa tocar un servidor de Evolution compartido. Un cliente
     que pudiera insertarse un bot apuntando al servidor de otro
     tendría el bot de otro.

   · Tampoco puede borrarlo: si pudiera, se quedaría sin servicio y sin
     histórico, y no habría forma de deshacerlo.

   · La url y la clave ya no están en su fila. Viven en
     `evolution_servers`, que no tiene ninguna política RLS: solo la
     alcanza el servidor con la secret key. Por eso aquí se consulta el
     estado con la secret key y al cliente solo se le devuelve el
     RESULTADO, nunca las credenciales.

     Antes se llamaba a `sanitizeInstance()`, que quitaba url y clave de
     la respuesta. Ya no hace falta quitar nada porque nunca se
     cargan: es una defensa mejor no traerlas.
   ========================================================= */

/** Cuánto se considera fresco un estado antes de volver a preguntar a Evolution. */
const STATUS_TTL_MS = 60_000;

/**
 * Cache en memoria del estado de Evolution.
 *
 * Es por petición/proceso: en Coolify hay una sola instancia, así que
 * sirve. Con varias, cada una tendría la suya y se frescos un poco más
 * a menudo. No es un problema: el TTL es de un minuto.
 */
const statusCache = new Map<string, { status: string; at: number }>();

/** Lo que se devuelve al cliente. Nunca incluye url ni clave. */
interface BotPublico {
  id: string;
  name: string;
  instance_name: string;
  slug: string;
  status: string;
  status_checked_at: string | null;
  welcome_message: string | null;
  outside_hours_message: string | null;
}

function publico(b: Record<string, unknown>): BotPublico {
  return {
    id: b.id as string,
    name: b.name as string,
    instance_name: b.instance_name as string,
    slug: b.slug as string,
    status: (b.status as string) ?? "close",
    status_checked_at: (b.status_checked_at as string) ?? null,
    welcome_message: (b.welcome_message as string) ?? null,
    outside_hours_message: (b.outside_hours_message as string) ?? null,
  };
}

// GET /api/instances?lite=1
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const lite = new URL(request.url).searchParams.get("lite") === "1";

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  /* Con RLS: solo se ve su propio bot. La consulta va por el cliente de
     la sesión a propósito, aunque `botDeLaSesion` ya lo asegure. */
  const { data: fila, error } = await db
    .from("bots")
    .select("id, name, instance_name, slug, status, status_checked_at, welcome_message, outside_hours_message")
    .eq("client_id", session.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo leer el bot" }, { status: 500 });
  if (!fila) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  const bot = publico(fila as unknown as Record<string, unknown>);

  if (lite) return NextResponse.json({ status: "success", data: [bot] });

  /* Estado en vivo: se pregunta a Evolution si el último dato es viejo.

     El JOIN trae url y clave, que están en `evolution_servers`. Van con
     la secret key: esa tabla no tiene políticas RLS a propósito, así
     que el cliente NUNCA puede leerla por sí mismo. Aquí solo las usa
     el servidor para hablar con Evolution, y no se devuelven.

     El hint `evolution_servers:server_id` es obligatorio: sin él
     PostgREST no sabe por qué columna se enlaza (la FK se llama
     `server_id`, no `evolution_servers_id`). */
  const { data: conCredenciales } = await getAdmin()
    .from("bots")
    .select("instance_name, evolution_servers:server_id(url, api_key)")
    .eq("id", bot.id)
    .maybeSingle();

  /* PostgREST devuelve el JOIN anidado como OBJETO cuando la relación es
   "many-to-one" (un bot pertenece a un servidor), pero devuelve ARRAY si
   no sabe la cardinalidad. Por eso se normaliza: con un tipo explícito
   queda claro, y no hay un `as` dentro de paréntesis que el parser de
   TypeScript confunde. */
type ServidorUnido = { evolution_servers: { url: string; api_key: string } | null };
type ServidorUnidoArray = { evolution_servers: Array<{ url: string; api_key: string }> };

const unido = conCredenciales as unknown as Partial<ServidorUnido & ServidorUnidoArray>;
const nodo = Array.isArray(unido.evolution_servers) ? unido.evolution_servers[0] : unido.evolution_servers;
const url = nodo?.url;
const clave = nodo?.api_key;

if (!url || !clave) return NextResponse.json({ status: "success", data: [bot] });

  /* Fresco o cacheado: no se pregunta a Evolution en cada recarga de
     la página, que sería una llamada externa por render. */
  const ahora = Date.now();
  if (bot.status_checked_at) {
    const t = new Date(bot.status_checked_at).getTime();
    if (!Number.isNaN(t) && ahora - t < STATUS_TTL_MS) {
      return NextResponse.json({ status: "success", data: [bot] });
    }
  }

  const cacheKey = `${url}|${bot.instance_name}`;
  const cached = statusCache.get(cacheKey);
  if (cached && ahora - cached.at < STATUS_TTL_MS) {
    return NextResponse.json({ status: "success", data: [{ ...bot, status: cached.status }] });
  }

  const estado = await getConnectionState(url, clave, bot.instance_name);
  if (estado.ok && estado.data) {
    statusCache.set(cacheKey, { status: estado.data, at: Date.now() });

    const marca = new Date().toISOString();
    /* El estado se guarda para la próxima. Si falla, da igual: es
       informativo y no debe romper la respuesta. */
    await getAdmin()
      .from("bots")
      .update({ status: estado.data, status_checked_at: marca })
      .eq("id", bot.id);

    return NextResponse.json({
      status: "success",
      data: [{ ...bot, status: estado.data, status_checked_at: marca }],
    });
  }

  return NextResponse.json({ status: "success", data: [bot] });
}

/* ---------------------------------------------------------------------
   POST y DELETE ya no existen
   ---------------------------------------------------------------------
   El alta de un bot la hace el equipo de Nexo Studio desde el panel
   (crear el bot, apuntarlo a un servidor de Evolution y darlo de alta),
   y el borrado también, con su historial.

   Decir 405 con dónde hacerlo es mejor que devolver un 403 de RLS sin
   explicación: el cliente vería "prohibido" y no sabría que la
   operación existe y se hace en otro sitio. */

// POST /api/instances
export async function POST() {
  return NextResponse.json(
    {
      status: "error",
      error:
        "El alta de bots la hace el equipo de Nexo Studio. Escríbenos y lo montamos.",
    },
    { status: 405 }
  );
}

// DELETE /api/instances
export async function DELETE() {
  return NextResponse.json(
    {
      status: "error",
      error:
        "Un bot no se puede borrar desde aquí: se quedaría sin servicio y sin historial.",
    },
    { status: 405 }
  );
}