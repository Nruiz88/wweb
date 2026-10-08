import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/* =========================================================
   Ajustes del bot: bienvenida, fuera de horario y la palabra
   que abre la agenda
   ---------------------------------------------------------
   Antes pedía `?instanceId=` y comprobaba el acceso con una consulta a
   `profiles`. Ahora el bot sale de `botDeLaSesion()`, que lo busca con
   el cliente del usuario (RLS), y el `bot_id` va en el propio WHERE.

   El UPDATE no lleva `updated_at`: lo pone el trigger
   `bot_touch_updated_at` de la tabla.

   `booking_keyword` (migración 020) va APARTE a propósito, y no por
   estética. Si la migración todavía no está aplicada, la columna no existe
   y un `select("welcome_message, ..., booking_keyword")` revienta con
   "column does not exist" → 500 → la pantalla de HORARIOS deja de cargar
   entera. Con el SELECT aparte, si falta la columna se devuelve `null` y
   todo lo demás sigue funcionando. Es la diferencia entre "una palabra
   configurable todavía no disponible" y "el calendario caído".
   ========================================================= */

/** Una sola palabra, de 2 a 40 letras, sin espacios (ver migración 020). */
function palabraValida(valor: string): boolean {
  return valor.length >= 2 && valor.length <= 40 && !/\s/.test(valor);
}

async function contexto() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) };

  const db = clienteDeLaSesion(session);
  if (!db) return { error: NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 }) };

  const bot = await botDeLaSesion(session);
  if (!bot) return { error: NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 }) };

  return { db, bot };
}

// GET /api/instance-settings
export async function GET() {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.db
    .from("bots")
    .select("welcome_message, outside_hours_message")
    .eq("id", ctx.bot.id)
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo leer" }, { status: 500 });

  let bookingKeyword: string | null = null;
  try {
    const { data: fila } = await ctx.db
      .from("bots")
      .select("booking_keyword")
      .eq("id", ctx.bot.id)
      .maybeSingle();
    bookingKeyword = (fila as { booking_keyword?: string | null } | null)?.booking_keyword ?? null;
  } catch {
    // Migración 020 sin aplicar. No es motivo para devolver un error.
    bookingKeyword = null;
  }

  return NextResponse.json({
    status: "success",
    data: { ...(data ?? {}), booking_keyword: bookingKeyword },
  });
}

// PATCH /api/instance-settings { welcomeMessage?, outsideHoursMessage?, bookingKeyword? }
export async function PATCH(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "instance-settings", {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { welcomeMessage, outsideHoursMessage, bookingKeyword } = (body ?? {}) as {
    welcomeMessage?: unknown;
    outsideHoursMessage?: unknown;
    bookingKeyword?: unknown;
  };

  /* La palabra de la agenda se escribe con su propia llamada.

     Mezclarla en el objeto `updates` de los mensajes obligaría a que una
     migración sin aplicar rompiera el guardado del saludo de bienvenida
     también, que no tiene nada que ver. */
  if (bookingKeyword !== undefined) {
    const limpio = String(bookingKeyword ?? "").trim().toLowerCase();

    if (limpio === "") {
      const { error: err } = await ctx.db.from("bots").update({ booking_keyword: null }).eq("id", ctx.bot.id);
      if (err) {
        return NextResponse.json(
          { status: "error", error: "No se pudo borrar la palabra clave. ¿Está aplicada la migración 020?" },
          { status: 500 }
        );
      }
    } else if (palabraValida(limpio)) {
      const { error: err } = await ctx.db.from("bots").update({ booking_keyword: limpio }).eq("id", ctx.bot.id);
      if (err) {
        return NextResponse.json(
          { status: "error", error: "No se pudo guardar la palabra clave. ¿Está aplicada la migración 020?" },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { status: "error", error: "La palabra clave debe ser una sola palabra, de 2 a 40 letras" },
        { status: 400 }
      );
    }
  }

  /* Solo se escriben los campos PRESENTES. Antes se mandaban los dos
     siempre, y como `sanitizeString(undefined)` devuelve null, guardar
     solo uno BORRABA el otro sin avisar. */
  const updates: Record<string, unknown> = {};
  if (welcomeMessage !== undefined) {
    updates.welcome_message = welcomeMessage ? String(welcomeMessage).slice(0, 1000) : null;
  }
  if (outsideHoursMessage !== undefined) {
    updates.outside_hours_message = outsideHoursMessage ? String(outsideHoursMessage).slice(0, 1000) : null;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ status: "success" });

  const { error } = await ctx.db
    .from("bots")
    .update(updates)
    .eq("id", ctx.bot.id);

  if (error) return NextResponse.json({ status: "error", error: "No se pudo guardar" }, { status: 500 });

  return NextResponse.json({ status: "success" });
}