import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/* =========================================================
   Histórico de respuestas del bot
   ---------------------------------------------------------
   Antes pedía `?instanceId=` y lo comprobaba con `verifyUserAccess`.
   Ahora el bot sale de `botDeLaSesion()`, que lo busca con el cliente
   del usuario: RLS decide.

   La consulta va con el cliente de Supabase en vez de con `query()`
   porque `query()` va a `ejecutar_sql`, que es de solo lectura. Aquí
   solo se lee, así que también valdría, pero usar el cliente evita el
   salto de RLS y de paso el `select` anidado que tenía la UI.
   ========================================================= */

// GET /api/logs?limit=50&offset=0
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const db = clienteDeLaSesion(session);
  if (!db) return NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 });

  const bot = await botDeLaSesion(session);
  if (!bot) return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });

  const { searchParams } = new URL(request.url);

  /* Límite acotado. Sin tope, `?limit=1000000` traía la tabla entera
     y era una forma barata de tumbar la petición. */
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const { data, error, count } = await db
    .from("bots_response_logs")
    .select(
      "id, incoming_phone, incoming_message, matched_keyword, sent_at, bots_responses(response_text)",
      { count: "exact" }
    )
    .eq("bot_id", bot.id)
    .order("sent_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ status: "error", error: "No se pudieron leer los registros" }, { status: 500 });

  /* El anidado de PostgREST devuelve `bots_responses` con la forma
     `{ response_text }`, que es lo que la UI espera en `auto_responses`.
     Antes venía de un LEFT JOIN con un alias (`ar_response_text`) que
     luego se reetiquetaba a mano. */
  const logs = (data ?? []).map((l) => ({
    id: l.id,
    incoming_phone: l.incoming_phone,
    incoming_message: l.incoming_message,
    matched_keyword: l.matched_keyword,
    sent_at: l.sent_at,
    auto_responses: l.bots_responses ?? null,
  }));

  return NextResponse.json({
    status: "success",
    data: { logs, total: count ?? 0, limit, offset },
  });
}