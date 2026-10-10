import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { slugify } from "@/lib/slug";
import { BUSINESS_TIMEZONE, todayInBusinessTimezone, timeInBusinessTimezone } from "@/lib/timezone";
import { getAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

/* =========================================================
   Disponibilidad pública de un bot
   ---------------------------------------------------------
   ESTA RUTA ES PÚBLICA, y tiene que serlo: la usan los clientes
   finales del comercio para reservar, y ellos no tienen cuenta en Nexo
   Studio ni en ningún sitio. Por eso no pide sesión y no usa RLS: usa
   la secret key y **devuelve solo horarios libres**, nunca datos del
   negocio.

   QUÉ CAMBIÓ
   ---------
   Antes resolvía el negocio comparando el `?business=` contra el nombre
   o el email de CADA usuario de la tabla `profiles`:
   `SELECT ... FROM profiles` y luego un `.find()` en JavaScript.

   Eso tenía dos problemas, y el segundo es el gordo:

     1. Era un escaneo de la tabla entera en cada visita a la agenda.
     2. Con `?user=<email>` bastaba con poner el email de CUALQUIER
        cliente para ver sus horarios. Y como un mismo negocio puede
        tener varias instancias, los datos de un usuario se mezclaban
        con los de otro.

   Ahora es `where slug = ?`. El `slug` es único en la base de datos
   (restricción `ux` en `bots`), así que:

     · es una consulta indexada, no un escaneo
     · no se puede pedir la agenda de otro con un email
     · no puede devolver datos de dos negocios a la vez

   El enlace que manda el bot por WhatsApp ya usa este formato
   (`/agendar/<slug>`), y ya no depende de que el nombre del negocio no
   cambie: antes, si lo cambiabas, los enlaces enviados dejaban de
   funcionar.
   ========================================================= */

/** Genera los huecos de un día entre dos horas. */
function generateSlots(
  startTime: string,
  endTime: string,
  durationMin: number
): Array<{ time: string; display: string }> {
  const slots: Array<{ time: string; display: string }> = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  for (let m = startMin; m + durationMin <= endMin; m += durationMin) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push({
      time: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
      display: `${h}:${String(min).padStart(2, "0")}`,
    });
  }
  return slots;
}

/** Días a partir de hoy, en la zona del negocio. */
function proximosDias(cuantos: number): string[] {
  const hoy = todayInBusinessTimezone();
  const dias: string[] = [];
  for (let i = 0; i < cuantos; i++) {
    const base = new Date(`${hoy}T12:00:00`);
    base.setDate(base.getDate() + i);
    dias.push(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(base)
    );
  }
  return dias;
}

// GET /api/public/agenda?slug=<slug del bot>
export async function GET(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "public-agenda", {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase();

  if (!slug) {
    return NextResponse.json(
      { status: "error", error: "slug is required" },
      { status: 400 }
    );
  }

  /* Un slug son letras minúsculas, números y guiones: se filtra antes
     de consultar. Con el `where` de Supabase no hay inyección posible
     igual, pero así tampoco se spends una consulta con basura. */
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
    return NextResponse.json({ status: "error", error: "slug inválido" }, { status: 400 });
  }

  const db = getAdmin();

  const { data: bot, error: errorBot } = await db
    .from("bots")
    .select("id, instance_name, name")
    .eq("slug", slug)
    .maybeSingle();

  if (errorBot) {
    console.error("[agenda] buscando el bot:", errorBot.message);
    return NextResponse.json({ status: "error", error: "No se pudo consultar" }, { status: 500 });
  }
  if (!bot) {
    return NextResponse.json({ status: "error", error: "Agenda no encontrada" }, { status: 404 });
  }

  const hoy = todayInBusinessTimezone();
  const desde = hoy;
  const hasta = proximosDias(14)[13];

  const { data: horarios, error: errorHorarios } = await db
    .from("bots_business_hours")
    .select("day_of_week, start_time, end_time, slot_duration_min")
    .eq("bot_id", bot.id)
    .eq("is_active", true);

  if (errorHorarios) {
    console.error("[agenda] horarios:", errorHorarios.message);
    return NextResponse.json({ status: "error", error: "No se pudo consultar" }, { status: 500 });
  }

  const { data: ocupadas, error: errorOcupadas } = await db
    .from("bots_appointments")
    .select("appointment_date, appointment_time")
    .eq("bot_id", bot.id)
    .in("status", ["pending", "confirmed"])
    .gte("appointment_date", desde)
    .lte("appointment_date", hasta);

  if (errorOcupadas) {
    console.error("[agenda] citas:", errorOcupadas.message);
    return NextResponse.json({ status: "error", error: "No se pudo consultar" }, { status: 500 });
  }

  const porDia = new Map<number, { start_time: string; end_time: string; slot_duration_min: number }>();
  for (const h of horarios ?? []) porDia.set(h.day_of_week, h);

  const ocupadoSet = new Set<string>();
  for (const o of ocupadas ?? []) {
    ocupadoSet.add(`${o.appointment_date}|${o.appointment_time.slice(0, 5)}`);
  }

  /* La hora "ahora" en la zona del negocio, no la del servidor: el
     servidor corre en UTC y con BUSINESS_TIMEZONE en América el filtro
     dejaba huecos ya pasados. */
  const ahora = timeInBusinessTimezone();
  const [ah, am] = ahora.split(":").map(Number);
  const ahoraMin = ah * 60 + am;

  const dias = proximosDias(14);
  const lista = dias
    .map((fecha) => {
      const dow = new Date(`${fecha}T12:00:00`).getDay();
      const h = porDia.get(dow);
      if (!h) return { date: fecha, slots: [] };

      const todos = generateSlots(h.start_time, h.end_time, h.slot_duration_min);

      const slots = todos.filter((s) => {
        if (ocupadoSet.has(`${fecha}|${s.time}`)) return false;
        /* Hoy solo lo que aún no pasó. */
        if (fecha === hoy) {
          const [sh, sm] = s.time.split(":").map(Number);
          if (sh * 60 + sm <= ahoraMin) return false;
        }
        return true;
      });

      return { date: fecha, slots };
    })
    .filter((d) => d.slots.length > 0);

  return NextResponse.json({
    status: "success",
    data: {
      bot: { name: bot.name, instanceName: bot.instance_name },
      days: lista,
    },
  });
}