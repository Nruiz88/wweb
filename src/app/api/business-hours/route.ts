import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/* =========================================================
   Horario de atención del bot
   ---------------------------------------------------------
   Tres cosas cambiaron aquí:

   1. El bot sale de `botDeLaSesion()` (RLS) en vez de `?instanceId=`
      con `verifyUserAccess`.

   2. El `ON DUPLICATE KEY UPDATE ... VALUES(x)` de MariaDB no existe
      en Postgres. El cliente de Supabase hace lo mismo con `.upsert()`
      y `onConflict: "bot_id,day_of_week"`, que es la restricción
      `un_dia_por_bot` que hay en la tabla (migración 011). Ese
      conflict target tiene que existir en la base o Postgres avisa;
      está puesto ahí a propósito.

   3. Desaparecen el gating por plan (`requireProFeature`) y el
      `user_id`. El primero porque el cobro lo hace Nexo Studio; el
      segundo porque esa columna ya no está en el esquema.
   ========================================================= */

/** Columnas que espera la UI. `user_id` ya no existe. */
const COLUMNAS =
  "id, day_of_week, start_time, end_time, slot_duration_min, is_active";

// GET /api/business-hours
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  const bot = await botDeLaSesion(session);
  if (!bot) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  const { data, error } = await db
    .from("bots_business_hours")
    .select(COLUMNAS)
    .eq("bot_id", bot.id)
    .order("day_of_week", { ascending: true });

  if (error) return NextResponse.json({ status: "error", error: "No se pudo leer el horario" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? [] });
}

interface DiaEntrada {
  dayOfWeek?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  slotDurationMin?: unknown;
  isActive?: unknown;
}

// POST /api/business-hours { schedule: [...] }
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "business-hours", {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  const bot = await botDeLaSesion(session);
  if (!bot) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { schedule } = body as { schedule?: DiaEntrada[] };
  if (!Array.isArray(schedule) || schedule.length === 0) {
    return NextResponse.json({ status: "error", error: "schedule is required" }, { status: 400 });
  }

  /* Se valida ANTES de escribir, y todo o nada.

     Antes cada día se insertaba en su propio bucle: si el tercero
     tenía una hora mala, los dos primeros ya estaban guardados y la
     respuesta era un error. El horario de un comercio queda a medias y
     nadie sabe qué parte es la buena. */
  const filas: Record<string, unknown>[] = [];
  const errores: string[] = [];

  for (const dia of schedule) {
    const d = Number(dia.dayOfWeek);
    const desde = String(dia.startTime ?? "");
    const hasta = String(dia.endTime ?? "");
    const duracion = Number(dia.slotDurationMin ?? 30);

    if (!Number.isInteger(d) || d < 0 || d > 6) {
      errores.push(`Día inválido: ${String(dia.dayOfWeek)}`);
      continue;
    }
    /* "HH:MM" a secas. Con algo más detrás ("09:00:00") el cast a time
       de Postgres funciona, pero la comparación `hasta > desde` de la
       restricción `hora_coherente` se evaluaba como texto y "09:00" >
       "09:00:00" es false: un día con hora de inicio y fin iguales se
       aceptaba y creaba un horario de cero minutos. */
    const formato = /^([01]\d|2[0-3]):[0-5]\d$/.test(desde) && /^([01]\d|2[0-3]):[0-5]\d$/.test(hasta);
    if (!formato) {
      errores.push(`Hora inválida el día ${d}: "${desde}" - "${hasta}"`);
      continue;
    }
    if (hasta <= desde) {
      errores.push(`El día ${d} termina antes de empezar`);
      continue;
    }
    if (!(duracion >= 10 && duracion <= 120)) {
      errores.push(`Duración inválida el día ${d}: ${duracion} minutos`);
      continue;
    }

    filas.push({
      bot_id: bot.id,
      day_of_week: d,
      start_time: desde,
      end_time: hasta,
      slot_duration_min: duracion,
      is_active: dia.isActive ?? true,
    });
  }

  if (errores.length) {
    return NextResponse.json(
      { status: "error", error: "El horario no es válido", detalle: errores },
      { status: 400 }
    );
  }

  const { error } = await db
    .from("bots_business_hours")
    .upsert(filas, { onConflict: "bot_id,day_of_week" });

  if (error) return NextResponse.json({ status: "error", error: "No se pudo guardar el horario" }, { status: 500 });

  return NextResponse.json({ status: "success", data: filas });
}