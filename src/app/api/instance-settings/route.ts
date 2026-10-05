import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/* =========================================================
   Mensajes de bienvenida y fuera de horario
   ---------------------------------------------------------
   Antes pedía `?instanceId=` y comprobaba el acceso con una consulta a
   `profiles`. Ahora el bot sale de `botDeLaSesion()`, que lo busca con
   el cliente del usuario (RLS), y el `bot_id` va en el propio WHERE.

   El UPDATE no lleva `updated_at`: lo pone el trigger
   `bot_touch_updated_at` de la tabla.
   ========================================================= */

// GET /api/instance-settings
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  const bot = await botDeLaSesion(session);
  if (!bot) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  const { data, error } = await db
    .from("bots")
    .select("welcome_message, outside_hours_message")
    .eq("id", bot.id)
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo leer" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? {} });
}

// PATCH /api/instance-settings { welcomeMessage, outsideHoursMessage }
export async function PATCH(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "instance-settings", {
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

  const { welcomeMessage, outsideHoursMessage } = (body ?? {}) as {
    welcomeMessage?: unknown;
    outsideHoursMessage?: unknown;
  };

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

  const { data, error } = await db
    .from("bots")
    .update(updates)
    .eq("id", bot.id)
    .select("welcome_message, outside_hours_message")
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo guardar" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? {} });
}
