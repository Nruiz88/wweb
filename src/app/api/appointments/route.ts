import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isValidId } from "@/lib/validation";

export const dynamic = "force-dynamic";

/* =========================================================
   Citas del bot
   ---------------------------------------------------------
   El bot sale de `botDeLaSesion()` (RLS), no de `?instanceId=`.

   El double-booking ya no se comprueba en el código: hay un
   `EXCLUDE USING gist` en `bots_appointments` (migración 011 del
   panel) que lo impide en la propia base. Antes era un SELECT previo,
   y dos peticiones simultáneas se colaban las dos. Aquí el INSERT que
   pisa un hueco falla con 23P01 y se traduce a 409.

   ⚠️  DELETE NO EXISTE, Y ES A PROPÓSITO
   ------------------------------------
   `bots_appointments` no tiene política de borrado: el cliente lee,
   crea y edita, pero no borra. El histórico de una agenda no se puede
   reescribir a posteriori; si se pudiera, un problema de citas quedaría
   sin rastro y no se podría auditar nunca. Por eso DELETE responde
   405 y explica que se cancele.
   ========================================================= */

const ESTADOS = ["pending", "confirmed", "canceled", "completed"];

const COLUMNAS =
  "id, customer_phone, customer_name, appointment_date, appointment_time, duration_min, status, notes, created_at";

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

// GET /api/appointments?status=&from=&to=&phone=
export async function GET(request: Request) {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const { searchParams } = new URL(request.url);

  let q = ctx.db
    .from("bots_appointments")
    .select(COLUMNAS)
    .eq("bot_id", ctx.bot.id)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  const status = searchParams.get("status");
  if (status && ESTADOS.includes(status)) q = q.eq("status", status);

  const desde = searchParams.get("from");
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte("appointment_date", desde);

  const hasta = searchParams.get("to");
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte("appointment_date", hasta);

  const phone = searchParams.get("phone");
  if (phone) q = q.eq("customer_phone", phone);

  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", error: "No se pudieron leer las citas" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? [] });
}

// POST /api/appointments { customerPhone, customerName, appointmentDate, appointmentTime, durationMin, notes }
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", {
    maxRequests: 30,
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

  const { customerPhone, customerName, appointmentDate, appointmentTime, durationMin, notes } = body as Record<string, unknown>;

  if (!customerPhone || !appointmentDate || !appointmentTime) {
    return NextResponse.json(
      { status: "error", error: "customerPhone, appointmentDate y appointmentTime son obligatorios" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(appointmentDate)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(appointmentTime))) {
    return NextResponse.json({ status: "error", error: "Fecha u hora con formato inválido" }, { status: 400 });
  }

  const duracion = Number(durationMin ?? 30);
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return NextResponse.json({ status: "error", error: "Duración inválida" }, { status: 400 });
  }

  const { data, error } = await ctx.db
    .from("bots_appointments")
    .insert({
      bot_id: ctx.bot.id,
      customer_phone: String(customerPhone),
      customer_name: customerName ? String(customerName) : null,
      appointment_date: String(appointmentDate),
      appointment_time: String(appointmentTime),
      duration_min: duracion,
      status: "pending",
      notes: notes ? String(notes) : null,
    })
    .select("id, appointment_date, appointment_time")
    .single();

  if (error) {
    /* 23P01 es la violación del EXCLUDE: el hueco ya está ocupado.
       Es la respuesta CORRECTA a dos peticiones simultáneas, que antes
       se colaban porque el SELECT previo no las veía. */
    if (error.code === "23P01") {
      return NextResponse.json({ status: "error", error: "Este horario ya está ocupado" }, { status: 409 });
    }
    /* 23503 sería un bot_id que no existe: no debería llegar aquí
       porque sale de una consulta con RLS, pero se distingue del 500
       genérico por si algún día lo hace. */
    if (error.code === "23503") {
      return NextResponse.json({ status: "error", error: "Bot no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ status: "error", error: "No se pudo crear la cita" }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data });
}

// PATCH /api/appointments { id, status, notes, reminder24hSent }
export async function PATCH(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "appointments", {
    maxRequests: 30,
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

  const { id, status, notes, reminder24hSent } = body as Record<string, unknown>;
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    if (typeof status !== "string" || !ESTADOS.includes(status)) {
      return NextResponse.json({ status: "error", error: "status inválido" }, { status: 400 });
    }
    updates.status = status;
  }
  if (notes !== undefined) updates.notes = notes ? String(notes) : null;
  if (reminder24hSent !== undefined) updates.reminder_24h_sent = !!reminder24hSent;

  if (Object.keys(updates).length === 0) return NextResponse.json({ status: "success" });

  /* Cancelar libera el hueco: el filtro `where (estado in
     ('pending','confirmed'))` del EXCLUDE deja de contar esa fila. Por
     eso se cancela en vez de borrar. */
  const { data, error } = await ctx.db
    .from("bots_appointments")
    .update(updates)
    .eq("id", id)
    .eq("bot_id", ctx.bot.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23P01") {
      return NextResponse.json({ status: "error", error: "Ese hueco pisa otra cita" }, { status: 409 });
    }
    return NextResponse.json({ status: "error", error: "No se pudo actualizar" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ status: "error", error: "Appointment not found" }, { status: 404 });

  return NextResponse.json({ status: "success", data: { id, ...updates } });
}

// DELETE /api/appointments?id=xxx
export async function DELETE() {
  /* Se responde y no se ejecuta. Ver la nota de arriba: no hay
     política de borrado, y devolver un 403 de RLS sin explicar nada
     dejaría al cliente creyendo que es un problema de permisos. */
  return NextResponse.json(
    {
      status: "error",
      error: "Las citas no se borran, se cancelan: el histórico de la agenda no se puede reescribir.",
      usa: { metodo: "PATCH", cuerpo: { id: "...", status: "canceled" } },
    },
    { status: 405 }
  );
}