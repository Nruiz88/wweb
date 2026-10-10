import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { todayInBusinessTimezone, timeInBusinessTimezone } from "@/lib/timezone";
import { getAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

/* =========================================================
   Reserva pública (sin cuenta)
   ---------------------------------------------------------
   La usan los clientes finales del comercio. No tienen sesión, así
   que todo sale de la secret key y **entra solo lo justo**: un slug, un
   nombre, un teléfono y el hueco que quieren. Nada de eso identifica a
   nadie, y lo único que se guarda es a quién avisar.

   QUÉ CAMBIÓ
   ---------
   Antes identificaba el negocio con `?business=<slug del nombre>` o
   `userEmail=<email>`, y **`instanceId` venía en el cuerpo**. Eso
   significaba que quien quisiera podía mandar un `instanceId`
   cualquiera y reservar en el calendario de otro negocio. El
   `instanceId` no se comprobaba contra nada: se usaba tal cual en el
   INSERT.

   Ahora solo hay un identificador, el `slug` del bot, y el `bot_id` se
   saca de la base. No hay forma de pedir "reserva en este negocio"
   apuntando a otro.

   ⚠️  LA DOBLE RESERVA LA RESUELVE LA BASE
   ----------------------------------------
   Antes había un SELECT para buscar conflicto y luego un INSERT: dos
   visitas simultáneas al mismo hueco pasaban las dos y se creaban dos
   citas. Ahora el INSERT lleva contra una restricción `EXCLUDE USING
   gist` sobre el rango del turno, así que es imposible. El error
   `23P01` se traduce a un 409 con un mensaje que el cliente entiende.
   ========================================================= */

/** Formato de teléfono: solo dígitos, entre 7 y 15. */
function normalizaTelefono(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const digitos = v.replace(/\D/g, "");
  if (digitos.length < 7 || digitos.length > 15) return null;
  return digitos;
}

// POST /api/public/book { slug, customerName, customerPhone, appointmentDate, appointmentTime }
export async function POST(request: Request) {
  /* El rate limit va primero y es más estricto que en la agenda: aquí se
     escribe, y alguien que no para de reenviar reservas llena la agenda
     de basura. */
  const rateLimitErr = await rateLimitResponse(request, "public-book", {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, customerName, customerPhone, appointmentDate, appointmentTime } = (body ?? {}) as {
    slug?: unknown;
    customerName?: unknown;
    customerPhone?: unknown;
    appointmentDate?: unknown;
    appointmentTime?: unknown;
  };

  const limpio = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  const fecha = String(appointmentDate ?? "");
  const hora = String(appointmentTime ?? "");
  const nombre = typeof customerName === "string" ? customerName.trim().slice(0, 120) : "";
  const telefono = normalizaTelefono(customerPhone);

  if (!limpio || !fecha || !hora) {
    return NextResponse.json(
      { status: "error", error: "Falta el slug, la fecha o la hora" },
      { status: 400 }
    );
  }
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(limpio)) {
    return NextResponse.json({ status: "error", error: "slug inválido" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return NextResponse.json({ status: "error", error: "Fecha u hora con formato inválido" }, { status: 400 });
  }
  /* Sin teléfono no se puede avisar del recordatorio, y un turno sin
     contacto no sirve de nada. Antes `customer_phone` era NULL y la cita
     se creaba igual. */
  if (!telefono) {
    return NextResponse.json(
      { status: "error", error: "Necesitamos un teléfono para avisarte" },
      { status: 400 }
    );
  }

  const db = getAdmin();

  const { data: bot, error: errorBot } = await db
    .from("bots")
    .select("id")
    .eq("slug", limpio)
    .maybeSingle();

  if (errorBot) {
    console.error("[book] buscando el bot:", errorBot.message);
    return NextResponse.json({ status: "error", error: "No se pudo reservar" }, { status: 500 });
  }
  if (!bot) {
    return NextResponse.json({ status: "error", error: "Agenda no encontrada" }, { status: 404 });
  }

  /* ---- Horario de atención de ese día ---- */
  const dow = new Date(`${fecha}T12:00:00`).getDay();

  const { data: horarios } = await db
    .from("bots_business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("bot_id", bot.id)
    .eq("day_of_week", dow)
    .eq("is_active", true)
    .limit(1);

  if (!horarios || horarios.length === 0) {
    return NextResponse.json(
      { status: "error", error: "Ese día no hay atención" },
      { status: 400 }
    );
  }

  const horario = horarios[0];

  /* La hora debe caer dentro del rango Y respectar la duración del
     turno. Antes solo se validaba que el día tuviera horario: un POST
     directo podía inventar horas fuera de rango y meterlas en el
     calendario. */
  const [tH, tM] = hora.split(":").map(Number);
  const [sH, sM] = horario.start_time.split(":").map(Number);
  const [eH, eM] = horario.end_time.split(":").map(Number);
  const pedido = tH * 60 + tM;
  const inicio = sH * 60 + sM;
  const fin = eH * 60 + eM;
  const duracion = horario.slot_duration_min || 30;

  if (pedido < inicio || pedido + duracion > fin) {
    return NextResponse.json(
      {
        status: "error",
        error: `Ese horario está fuera del horario de atención (${horario.start_time} - ${horario.end_time})`,
      },
      { status: 400 }
    );
  }
  if (pedido % duracion !== inicio % duracion) {
    return NextResponse.json(
      { status: "error", error: "Ese horario no coincide con la duración del turno" },
      { status: 400 }
    );
  }

  /* No se reserva en el pasado. La comparación es en la zona del
     negocio, no la del servidor (que corre en UTC). */
  const hoy = todayInBusinessTimezone();
  const ahora = timeInBusinessTimezone();
  if (fecha < hoy || (fecha === hoy && hora <= ahora)) {
    return NextResponse.json(
      { status: "error", error: "Ese horario ya pasó. Elegí otro." },
      { status: 400 }
    );
  }

  /* ---- Insertar ---- */
  const { data: cita, error } = await db
    .from("bots_appointments")
    .insert({
      bot_id: bot.id,
      customer_name: nombre || null,
      customer_phone: telefono,
      appointment_date: fecha,
      appointment_time: hora,
      duration_min: duracion,
      status: "pending",
    })
    .select("id, appointment_date, appointment_time")
    .single();

  if (error) {
    /* 23P01 es la violación del EXCLUDE: el hueco se acaba de ocupar.
       Esto NO es un fallo, es la respuesta correcta, y es la primera
       vez que la base la da por sí sola en vez de un SELECT previo. */
    if (error.code === "23P01") {
      return NextResponse.json(
        { status: "error", error: "Ese horario acaba de ocuparse. Elegí otro." },
        { status: 409 }
      );
    }
    console.error("[book] insertando la cita:", error.message);
    return NextResponse.json(
      { status: "error", error: "No se pudo completar la reserva" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "success", data: cita });
}