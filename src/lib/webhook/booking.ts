import { sendTextMessage as sendTextMessageRaw, sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import type { WebhookContext } from "./context";
import { slugify } from "@/lib/slug";
import { matchPalabraAgenda } from "@/lib/booking-keywords";
import { query } from "@/lib/db";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Envía un texto y REGISTRA el fallo si Evolution no lo entrega.
 * Antes se ignoraba el resultado: el webhook devolvía 200 "success" y el
 * usuario no veía nada, sin ninguna señal en los logs (API key vencida, URL
 * vieja, timeout de 40s, JID inválido...).
 */
async function sendTextMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  text: string,
  delay?: number,
) {
  try {
    const res = await sendTextMessageRaw(baseUrl, apiKey, instanceName, number, text, delay);
    if (!res.ok) {
      console.error("[booking] Evolution NO envío el mensaje", {
        instance: instanceName,
        to: number,
        status: res.status,
        error: res.message,
      });
    }
    return res;
  } catch (err) {
    console.error("[booking] excepción enviando a Evolution", {
      instance: instanceName,
      to: number,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 0, message: String(err) } as any;
  }
}

// ─── UI de la agenda (menú y slots) ────────────────────────────────────────

/** Horarios por página en el listado de texto. */
const SLOTS_PER_PAGE = 8;

/**
 * Los botones interactivos de Evolution NO llegan al usuario en esta
 * instancia, así que la agenda va con texto formateado.
 *
 * `sendButtons` responde 200 con un `interactiveMessage` envuelto en
 * `viewOnceMessage` (verificado contra la API), o sea que Evolution lo acepta
 * pero queda marcado "ver una vez" y no se renderiza. `sendList` directamente
 * no devuelve nada.
 *
 * Con `AGENDA_USE_BUTTONS=1` se reactivan, por si el server de Evolution se
 * actualiza. while Eso no pase, el texto es el camino fiable.
 */
const USE_BUTTONS = process.env.AGENDA_USE_BUTTONS === "1";

/** Menú principal de la agenda. */
async function sendAgendaMenuButtons(ctx: WebhookContext): Promise<boolean> {
  if (!USE_BUTTONS) return false;
  const { instance, phoneNumber } = ctx;
  const business = await getBusinessName(instance.id, instance.instance_name);
  const res = await sendButtonMessage(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    phoneNumber,
    `🗓️  *Turnos — ${business}*`,
    "¿Qué querés ver?",
    [
      { type: "reply", displayText: "🕐 Libre hoy", id: "agenda_hoy" },
      { type: "reply", displayText: "⏭️ Más próximo", id: "agenda_proximo" },
      { type: "reply", displayText: "📅 Agenda completa", id: "agenda_completa" },
    ],
    business,
    800,
  );
  return res.ok;
}

/** Menú principal en texto (el camino que sí llega: los botones no). */
async function sendAgendaMenuText(ctx: WebhookContext): Promise<void> {
  const { instance, phoneNumber } = ctx;
  const business = await getBusinessName(instance.id, instance.instance_name);
  await sendTextMessage(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    phoneNumber,
    "╭━━━━━━━━━━━━━━━━━━━━━╮\n" +
      `  🗓️  *${business}*\n` +
      "╰━━━━━━━━━━━━━━━━━━━━━╯\n\n" +
      "  _Turnos — elegí una opción_ 👇\n\n" +
      "  ┌─────────────────────┐\n" +
      "  │ 1️⃣  🕐  *Libre hoy*\n" +
      "  │ 2️⃣  ⏭️  *Más próximo*\n" +
      "  │ 3️⃣  📅  *Agenda completa*\n" +
      "  └─────────────────────┘",
    1200,
  );
}

/** Listado de horarios en texto, paginado. El usuario responde con el número. */
async function sendSlotsAsText(
  ctx: WebhookContext,
  title: string,
  slots: string[],
  page: number,
  totalPages: number,
): Promise<void> {
  const { instance, phoneNumber } = ctx;
  const start = page * SLOTS_PER_PAGE;
  const pageSlots = slots.slice(start, start + SLOTS_PER_PAGE);
  const list = pageSlots.map((t, i) => `  ┣ ${String(start + i + 1).padStart(2)}. 🕐  *${t}* hs`).join("\n");

  const more =
    page < totalPages - 1
      ? `\n\n  ➡️ Respondé *${start + pageSlots.length + 1}* para ver más horarios`
      : "";

  const pageLabel = totalPages > 1 ? `   _pág. ${page + 1}/${totalPages}_` : "";
  const business = await getBusinessName(instance.id, instance.instance_name);

  await sendTextMessage(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name,
    phoneNumber,
    `${title}${pageLabel}\n` +
      "━━━━━━━━━━━━━━━━━━━━━━\n\n" +
      "  _Respondé con el número:_\n\n" +
      `${list}${more}\n\n` +
      `  0️⃣  🔙 Volver · ${business}`,
    1200,
  );
}

/** Lista los horarios. Botones si están habilitados, texto si no. */
async function sendSlotMenu(
  ctx: WebhookContext,
  title: string,
  dateIso: string,
  slots: string[],
  page = 0,
): Promise<void> {
  if (USE_BUTTONS) {
    const { instance, phoneNumber } = ctx;
    const totalPages = Math.max(1, Math.ceil(slots.length / 3));
    const safePage = Math.max(0, Math.min(page, totalPages - 1));
    const start = safePage * 3;
    const pageSlots = slots.slice(start, start + 3);
    const res = await sendButtonMessage(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      phoneNumber,
      title,
      "Tocá tu horario 👇",
      pageSlots.map((t) => ({
        type: "reply" as const,
        displayText: `🕐 ${t}`,
        id: `slot_${dateIso}_${t}`,
      })),
      "Turnos",
      800,
    );
    if (res.ok) return;
  }
  await sendSlotsAsText(ctx, title, slots, page, Math.max(1, Math.ceil(slots.length / SLOTS_PER_PAGE)));
}

/** Handler del botón "Ver más" (solo si hay botones habilitados). */
export async function handleSlotsMore(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;
  if (!effectiveText.startsWith("slots_more_")) return null;

  const m = /^slots_more_(\d{4}-\d{2}-\d{2})_(\d{1,3})$/.exec(effectiveText);
  if (!m) return null;
  const dateIso = m[1];

  const { slots, hours } = await getAvailableSlots(ctx, dateIso);
  if (!hours) return null;

  await sendSlotMenu(ctx, `🕐 *Horarios* — ${formatDateStr(dateIso)}`, dateIso, slots, 0);
  return { status: "success", matched: "[turno ver más horarios]" };
}


import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { getBusinessName } from "@/lib/business-name";
import { Redis } from "@upstash/redis";

function localDateStr(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function localTimeMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

// Redis distribuido para agenda/pending (serverless-safe) con fallback en memoria
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const pendingDateFallback = new Map<string, string>();
const agendaActiveFallback = new Map<string, boolean>();
const PENDING_TTL_MS = 10 * 60 * 1000;
const AGENDA_TTL_MS = 15 * 60 * 1000;

function agendaKey(ctx: WebhookContext): string {
  return `${ctx.instance.id}:${ctx.remoteJid}`;
}

/* ── EL VALOR DE LA BANDERA DEL MENÚ ──

   Se guardaba la cadena "1" y se comparaba con === "1". Con el Map de
   memoria eso nunca se notó, porque ahí lo que se guardaba era un
   booleano de verdad.

   Al pasar a Redis, NO. La librería deserializa lo que lee, y el texto
   "1" vuelve como el número 1:

       set(clave, "1")  ->  OK
       get(clave)       ->  1        (número, no texto)
       1 === "1"       ->  false

   O sea: el bot escribía el menú activo, lo leía, comparaba, obtenía
   false, y creía que nadie estaba en ningún menú. El "1" del cliente
   caía al final de la cadena de handlers y salía `no_match`.

   Y lo grave: la escritura funcionaba y no había ningún error. El
   bot no estaba roto ni Redis tampoco. Solo una comparación que nunca
   daba verdadero, y el flujo entero muerto detrás.

   La clave es que el valor NO sea un número escrito como texto, porque
   eso es justo lo que la librería convierte al leer. Una palabra no se
   parece a un número, y la comparación es exacta.

   Los datos guardados con el valor viejo no sirven: expiran en quince
   minutos, así que no hay nada que migrar. */
const MARCA_ACTIVA = "menu-agenda-activo";

async function markAgendaActive(ctx: WebhookContext): Promise<void> {
  const key = `agenda:${agendaKey(ctx)}`;
  /* El valor es una PALABRA y no "1". Ver la nota de arriba. */
  if (redis) await redis.set(key, MARCA_ACTIVA, { ex: Math.ceil(AGENDA_TTL_MS / 1000) });
  else {
    agendaActiveFallback.set(key, true);
    setTimeout(() => agendaActiveFallback.delete(key), AGENDA_TTL_MS);
  }
}

async function clearAgendaActive(ctx: WebhookContext): Promise<void> {
  const key = `agenda:${agendaKey(ctx)}`;
  if (redis) await redis.del(key);
  else agendaActiveFallback.delete(key);
}

/** True si el usuario está dentro del flujo de agenda (menú visible). */
export async function isAgendaActive(ctx: WebhookContext): Promise<boolean> {
  const key = `agenda:${agendaKey(ctx)}`;
  if (redis) return (await redis.get(key)) === MARCA_ACTIVA;
  return agendaActiveFallback.get(key) === true;
}

async function rememberDate(ctx: WebhookContext, date: string): Promise<void> {
  const key = `pending:${agendaKey(ctx)}`;
  if (redis) await redis.set(key, date, { ex: Math.ceil(PENDING_TTL_MS / 1000) });
  else {
    pendingDateFallback.set(key, date);
    setTimeout(() => pendingDateFallback.delete(key), PENDING_TTL_MS);
  }
}

async function peekPendingDate(ctx: WebhookContext): Promise<string | null> {
  const key = `pending:${agendaKey(ctx)}`;
  if (redis) return (await redis.get(key)) as string | null;
  return pendingDateFallback.get(key) ?? null;
}

async function getPendingDate(ctx: WebhookContext): Promise<string | null> {
  const key = `pending:${agendaKey(ctx)}`;
  if (redis) {
    const v = (await redis.get(key)) as string | null;
    if (v) await redis.del(key);
    return v;
  }
  const v = pendingDateFallback.get(key) ?? null;
  if (v) pendingDateFallback.delete(key);
  return v;
}

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Set de horarios ya reservados, en el MISMO formato que `generateSlots`.
 *
 * OJO con esto. `appointment_time` es una columna `time` y Postgres la
 * devuelve siempre como "HH:MM:SS", mientras que `generateSlots()` produce
 * "HH:MM". Con el `Set` armado tal cual, `bookedSet.has("11:00")` daba false
 * aunque hubiera un turno a las 11:00: los horarios reservados se seguían
 * ofreciendo y el usuario podía elegir uno ya tomado. El INSERT no mira este
 * Set, así que la reserva se guardaba igual y quedaban dos turnos en el mismo
 * horario (no hay UNIQUE en `(bot_id, appointment_date, appointment_time)`).
 *
 * La panel ya lo hace bien con su `formatTime()`; aquí faltaba el mismo corte.
 */
function horasReservadas(filas: { appointment_time: string }[] | null | undefined): Set<string> {
  return new Set((filas || []).map((f) => String(f.appointment_time).slice(0, 5)));
}

/** Generate HH:MM slots between start and end given a duration. */
function generateSlots(startTime: string, endTime: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
  for (let m = startMin; m + durationMin <= endMin; m += durationMin) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

/** Fetch available slots for a date (excludes booked + past times). */
async function getAvailableSlots(
  ctx: WebhookContext,
  date: string,
): Promise<{ slots: string[]; hours: { start_time: string; end_time: string; slot_duration_min: number } | null }> {
  const { supabase, instance } = ctx;
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const { data: hours } = await supabase
    .from("bots_business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("bot_id", instance.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) return { slots: [], hours: null };

  const all = generateSlots(hours.start_time, hours.end_time, hours.slot_duration_min);

  const { data: booked } = await supabase
    .from("bots_appointments")
    .select("appointment_time")
    .eq("bot_id", instance.id)
    .eq("appointment_date", date)
    .in("status", ["pending", "confirmed"]);

  const bookedSet = horasReservadas(booked);

  const now = new Date();
  const todayStr = localDateStr(now);
  const isToday = date === todayStr;
  const nowMinutes = localTimeMinutes(now);

  const slots = all.filter((t) => {
    if (bookedSet.has(t)) return false;
    if (isToday) {
      const [h, m] = t.split(":").map(Number);
      if (h * 60 + m <= nowMinutes) return false;
    }
    return true;
  });

  return { slots, hours };
}

/**
 * Agenda menu dispatcher: agenda_hoy / agenda_proximo / agenda_completa,
 * or shows the menu itself when no specific option was tapped.
 *
 * Uses plain-text numbered menus (NOT interactive buttons) because
 * Evolution 2.3.7 has a bug where sendButtons/sendList fail
 * (EvolutionAPI#2390, "this.isZero is not a function").
 */
export async function handleAgendaMenu(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;

  // Mientras se muestra cualquier opción del menú de agenda, la sesión está
  // activa (permite responder con 1/2/3 o con un número de horario).
  await markAgendaActive(ctx);

  if (effectiveText === "agenda_hoy") {
    return handleAgendaHoy(ctx);
  }
  if (effectiveText === "agenda_proximo") {
    return handleAgendaProximo(ctx);
  }
  if (effectiveText === "agenda_completa") {
    return handleAgendaCompleta(ctx);
  }

  const { instance, phoneNumber } = ctx;
  // Botones si el server los soporta; texto numerado si no.
  if (await sendAgendaMenuButtons(ctx)) {
    return { status: "success", matched: "[turno menú agenda]" };
  }
  console.warn("[booking] botones de menú no salieron, fallback a texto", { instance: instance.instance_name });
  await sendAgendaMenuText(ctx);
  return { status: "success", matched: "[turno menú agenda]" };
}

/** Agenda hoy: muestra los horarios libres de hoy en texto numerado. */
async function handleAgendaHoy(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const today = localDateStr(new Date());
  const { slots, hours } = await getAvailableSlots(ctx, today);

  if (!hours) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "😴 *Hoy no atendemos.*\n\n" +
        "Probá el *más próximo* 👇",
      1200,
    );
    await sendAgendaMenuButtons(ctx).catch(() => sendAgendaMenuText(ctx));
    return { status: "success", matched: "[turno hoy sin agenda]" };
  }

  if (slots.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "🈵 *Hoy no quedan horarios libres.*\n\n" +
        "Mirá el *más próximo* 👇",
      1200,
    );
    await sendAgendaMenuButtons(ctx).catch(() => sendAgendaMenuText(ctx));
    return { status: "success", matched: "[turno hoy sin slots]" };
  }

  await sendSlotMenu(ctx, `🕐 *Libre HOY* — ${formatDateStr(today)}`, today, slots);
  await rememberDate(ctx, today);
  return { status: "success", matched: "[turno hoy]" };
}

/** Agenda más próximo: busca el siguiente día hábil con horarios libres. */
async function handleAgendaProximo(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;

  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = localDateStr(d);
    const { slots } = await getAvailableSlots(ctx, dateStr);
    if (slots.length > 0) {
      await sendSlotMenu(ctx, `⏭️ *Libre* — ${formatDateStr(dateStr)}`, dateStr, slots);
      await rememberDate(ctx, dateStr);
      return { status: "success", matched: "[turno próximo]" };
    }
  }

  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    "🗓️ *No encontré disponibilidad* en los próximos 14 días.\n\n" +
      "Escreibinos y te buscamos un lugar 🙂",
    1200,
  );
  return { status: "success", matched: "[turno sin disponibilidad]" };
}

/** Agenda completa: envía el link público de agendado (referenciando al usuario). */
async function handleAgendaCompleta(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber } = ctx;
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, la agenda completa aún no está disponible. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  // El nombre del negocio y el enlace público de su agenda.
  //
  // Antes eran dos consultas más un slug derivado del dueño del bot y
  // de su nombre, y una URL con ?business=. Todo eso desapareció: el
  // dueño de un bot es ahora un cliente de Nexo Studio y su nombre está
  // en `clients.nombre`.
  //
  // La URL pasa a `/agendar/<slug del bot>` porque el bot ya tiene un slug
  // único en su fila. Con la anterior había que derivarlo del nombre del
  // negocio, y como el nombre puede cambiar, un enlace ya enviado se
  // quedaba roto.
  const { data: cliente } = await supabase
    .from("clients")
    .select("nombre")
    .eq("id", instance.client_id)
    .maybeSingle();

  const businessName = (cliente?.nombre ?? "").trim();

  if (!businessName) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.",
      1500,
    );
    return { status: "success", matched: "[turno sin link]" };
  }

  const identifier = instance.slug;
  const link = `${baseUrl}/agendar/${identifier}`;
  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `📅 Mirá toda la disponibilidad y reservá acá:\n\n${link}`,
    1500,
  );
  return { status: "success", matched: "[turno agenda completa]" };
}

/**
 * Handle confirm/cancel button taps from appointment reminders.
 * Button IDs: confirm_<apptId> or cancel_<apptId>
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleAppointmentConfirm(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;

  if (!effectiveText.startsWith("confirm_") && !effectiveText.startsWith("cancel_")) return null;

  const apptId = effectiveText.replace("confirm_", "").replace("cancel_", "");
  const newStatus = effectiveText.startsWith("confirm_") ? "confirmed" : "canceled";

  // UUID validation to prevent crafted IDs
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apptId)) {
    return null;
  }

  const { data: appt } = await supabase
    .from("bots_appointments")
    .select("id, bot_id, customer_name, appointment_date, appointment_time")
    .eq("id", apptId)
    .single();

  if (!appt) return null;

  // Authorization: only confirm/cancel appointments belonging to this instance
  if (appt.bot_id !== instance.id) return null;

  /* Con el cliente, no con `query()`.

     `query()` va a `ejecutar_sql`, que es de SOLO LECTURA (ver
     012_ejecutar_sql.sql en el panel): un UPDATE por ahí ya no se
     ejecutaría. Además `updated_at` no hace falta ponerlo: lo pone el
     trigger `bot_touch_updated_at`. */
  await supabase
    .from("bots_appointments")
    .update({ status: newStatus })
    .eq("id", apptId)
    .eq("bot_id", instance.id);

  const dateStr = formatDateStr(appt.appointment_date);
  const [h, m] = appt.appointment_time.split(":");
  const emoji = newStatus === "confirmed" ? "✅" : "❌";
  const text = newStatus === "confirmed" ? "confirmado" : "cancelado";

  await sendTextMessage(
    instance.evolution_api_url, instance.evolution_api_key,
    instance.instance_name, phoneNumber,
    `${emoji} Turno ${text} para ${dateStr} a las ${h}:${m}.${newStatus === "confirmed" ? " ¡Te esperamos!" : " Si necesitas otro turno, escribime."}`,
    1500,
  );
  return { status: "success", matched: `[turno ${newStatus}]` };
}

/**
 * Handle time slot selection from appointment booking.
 * Button ID: slot_<YYYY-MM-DD>_<HH:MM>
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, effectiveText, pushName } = ctx;

  if (!effectiveText.startsWith("slot_")) return null;

  const parts = effectiveText.replace("slot_", "");
  const lastUnderscore = parts.lastIndexOf("_");
  const slotDate = parts.slice(0, lastUnderscore);
  const slotTime = parts.slice(lastUnderscore + 1);

  // Validate date/time format to prevent injection
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate) || !/^\d{2}:\d{2}$/.test(slotTime)) {
    return null;
  }

  // Check conflict
  const { data: conflict } = await supabase
    .from("bots_appointments")
    .select("id")
    .eq("bot_id", instance.id)
    .eq("appointment_date", slotDate)
    .eq("appointment_time", slotTime)
    .in("status", ["pending", "confirmed"])
    .limit(1);

  if (conflict && conflict.length > 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      '❌ Ese horario ya fue tomado. Escribí "turno" para ver otros disponibles.',
      1500,
    );
    return { status: "success", matched: "[turno ocupado]" };
  }

  // Create appointment
  const { data: newAppt } = await supabase
    .from("bots_appointments")
    .insert({
      bot_id: instance.id,
      customer_phone: remoteJid,
      customer_name: pushName || null,
      appointment_date: slotDate,
      appointment_time: slotTime,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (newAppt) {
    const dateStr = formatDateStr(slotDate);
    const [h, m] = slotTime.split(":");
    // Cabecera de "ticket" para que el turno se vea reservado de una.
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "╭───────────────────╮\n" +
        "   ✅  *¡TURNO AGENDADO!*\n" +
        "╰───────────────────╯\n\n" +
        `📅  *${dateStr}*\n` +
        `🕐  *${h}:${m} hs*\n` +
        `📍  ${pushName || "Tu nombre"}\n` +
        "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n" +
        "Te recordamos 24 h antes. ¡Nos vemos! 🎉",
      1200,
    );
    return { status: "success", matched: "[turno agendado]" };
  }

  return null;
}

/**
 * Handle a numeric reply ("1", "2", ...) that refers to a slot previously
 * shown via the text menu. Uses the date remembered by handleAgendaHoy /
 * handleAgendaProximo.
 */
export async function handleNumericSlotSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, remoteJid, pushName, effectiveText } = ctx;

  const clean = effectiveText.trim();
  if (!/^\d{1,2}$/.test(clean)) return null;
  const index = parseInt(clean, 10);

  // "0" → volver al menú de agenda (consume el estado de la fecha)
  if (index === 0) {
    const date = await getPendingDate(ctx);
    if (date) {
      if (!(await sendAgendaMenuButtons(ctx))) {
        await sendAgendaMenuText(ctx);
      }
      return { status: "success", matched: "[turno volver]" };
    }
    return null;
  }

  if (index < 1 || index > 200) return null;

  // Peek (no consume): un intento inválido no rompe el flujo del usuario.
  const date = await peekPendingDate(ctx);
  if (!date) return null;

  const { slots } = await getAvailableSlots(ctx, date);

  // El número es más allá de la página actual → mostrar la siguiente en vez de
  //	error. El listado avisa "respondé N para ver más".
  const totalPages = Math.max(1, Math.ceil(slots.length / SLOTS_PER_PAGE));
  const page = Math.floor((index - 1) / SLOTS_PER_PAGE);
  if (page >= totalPages) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      `❌ Ese número no corresponde a un horario.\n\n` +
        `Hay *${slots.length}* horarios libres ese día. Escribí *turno* para empezar de nuevo.`,
      1200,
    );
    return { status: "success", matched: "[turno num inválido]" };
  }
  if ((index - 1) % SLOTS_PER_PAGE === 0 && index > 1) {
    await sendSlotMenu(
      ctx,
      `🕐 *Horarios* — ${formatDateStr(date)}`,
      date,
      slots,
      page,
    );
    return { status: "success", matched: "[turno paginación]" };
  }

  const chosen = slots[index - 1];
  if (!chosen) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ Ese número no corresponde a un horario. Escribí 'turno' para empezar de nuevo.",
      1500,
    );
    return { status: "success", matched: "[turno num inválido]" };
  }

  // Check conflict
  const { data: conflict } = await supabase
    .from("bots_appointments")
    .select("id")
    .eq("bot_id", instance.id)
    .eq("appointment_date", date)
    .eq("appointment_time", chosen)
    .in("status", ["pending", "confirmed"])
    .limit(1);

  if (conflict && conflict.length > 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      '❌ Ese horario ya fue tomado. Escribí "turno" para ver otros disponibles.',
      1500,
    );
    return { status: "success", matched: "[turno ocupado]" };
  }

  const { data: newAppt } = await supabase
    .from("bots_appointments")
    .insert({
      bot_id: instance.id,
      customer_phone: remoteJid,
      customer_name: pushName || null,
      appointment_date: date,
      appointment_time: chosen,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (newAppt) {
    // Turno agendado → el flujo de agenda TERMINA. Los números posteriores
    // ya no deben re-disparar el menú; se vuelve a empezar con la palabra clave.
    await getPendingDate(ctx);
    await clearAgendaActive(ctx);
    const dateStr = formatDateStr(date);
    const [h, m] = chosen.split(":");
    const business = await getBusinessName(instance.id, instance.instance_name);
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "╭━━━━━━━━━━━━━━━━━━━━━╮\n" +
        "   ✅  *¡TURNO AGENDADO!*\n" +
        "╰━━━━━━━━━━━━━━━━━━━━━╯\n\n" +
        `📅  *${dateStr}*\n` +
        `🕐  *${h}:${m} hs*\n` +
        `📍  ${business}\n` +
        "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n" +
        `Te recordamos desde ${business} 24 h antes. ¡Nos vemos! 🎉`,
      1200,
    );
    return { status: "success", matched: "[turno agendado]" };
  }

  return null;
}

/**
 * Handle date selection from appointment booking.
 * Button ID: date_<YYYY-MM-DD>
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleDateSelect(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber, effectiveText } = ctx;

  if (!effectiveText.startsWith("date_")) return null;

  const slotDate = effectiveText.replace("date_", "");
  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) return null;
  const dateObj = new Date(slotDate + "T12:00:00");
  const dayOfWeek = dateObj.getDay();

  const { data: hours } = await supabase
    .from("bots_business_hours")
    .select("start_time, end_time, slot_duration_min")
    .eq("bot_id", instance.id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (!hours) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      "❌ No hay horarios disponibles para ese día.",
      1500,
    );
    return { status: "success", matched: "[turno sin horarios]" };
  }

  // Generate slots
  const [sh, sm] = hours.start_time.split(":").map(Number);
  const [eh, em] = hours.end_time.split(":").map(Number);
  const dur = hours.slot_duration_min;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const { data: booked } = await supabase
    .from("bots_appointments")
    .select("appointment_time")
    .eq("bot_id", instance.id)
    .eq("appointment_date", slotDate)
    .in("status", ["pending", "confirmed"]);

  const bookedSet = horasReservadas(booked);

  const now = new Date();
  const isToday = slotDate === localDateStr(now);
  const nowMinutes = localTimeMinutes(now);

  const availableSlots: string[] = [];
  for (let m = startMin; m + dur <= endMin; m += dur) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (bookedSet.has(time)) continue;
    if (isToday && h * 60 + min <= nowMinutes) continue;
    availableSlots.push(time);
  }

  if (availableSlots.length === 0) {
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, phoneNumber,
      '❌ No hay horarios disponibles para ese día. Escribí "turno" para ver otros días.',
      1500,
    );
    return { status: "success", matched: "[turno sin slots]" };
  }

  const dateStr = formatDateStr(slotDate);
  await sendSlotMenu(ctx, `🕐 *Horarios* — ${dateStr}`, slotDate, availableSlots);
  await rememberDate(ctx, slotDate);
  return { status: "success", matched: "[turno selección hora]" };
}

/**
 * La palabra extra que el cliente configuró para su bot (`bots.booking_keyword`,
 * migración 020), si puso alguna.
 *
 * Se consulta SUELTA y con su propio try/catch, y no como parte del SELECT
 * grande de `route.ts`, por una razón concreta: si la migración todavía no
 * se aplicó, la columna no existe, Postgres tira, y como el error cae en un
 * `catch` el webhook devolvería 500 a TODO mensaje. O sea: añadir la columna
 * al SELECT de contexto rompe el bot entero hasta que se aplique la
 * migración. Así, si falta, se usan las palabras de siempre y no pasa nada.
 *
 * Solo se llega a mirar cuando el mensaje NO matchea ninguna de las de
 * siempre, así que en el camino habitual no se paga ninguna consulta.
 */
async function palabraDelBot(ctx: WebhookContext): Promise<string | null> {
  try {
    const filas = await query<{ booking_keyword: string | null }>(
      "SELECT booking_keyword FROM bots WHERE id = ? LIMIT 1",
      [ctx.instance.id]
    );
    return (filas?.[0]?.booking_keyword ?? "").trim() || null;
  } catch (e) {
    // La columna puede no existir todavía (migración sin aplicar). No es
    // motivo para romper el mensaje.
    console.warn("[booking] no se pudo leer booking_keyword", {
      instance: ctx.instance.instance_name,
      message: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Handle "turno" keyword: show the agenda menu (hoy / próximo / completa).
 * (ya no hay gating por plan: lo decide `tiene_modulo()` en Nexo Studio)
 */
export async function handleBookingIntent(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { effectiveText } = ctx;

  /* Primero las de siempre: es el caso normal y sale sin tocar la base. */
  let match = matchPalabraAgenda(effectiveText);
  if (!match) {
    match = matchPalabraAgenda(effectiveText, await palabraDelBot(ctx));
  }

  if (!match) return null;

  // Verify the agenda is configured at all before offering options
  const { supabase, instance } = ctx;
  const { data: bizHours } = await supabase
    .from("bots_business_hours")
    .select("id")
    .eq("bot_id", instance.id)
    .eq("is_active", true)
    .limit(1);

  if (!bizHours || bizHours.length === 0) {
    console.warn("[booking] agenda pedida pero sin business_hours", {
      instance: instance.instance_name,
      instanceId: instance.id,
    });
    await sendTextMessage(
      instance.evolution_api_url, instance.evolution_api_key,
      instance.instance_name, ctx.phoneNumber,
      "Todavía no hay horarios de atención cargados. ⏰\n\n" +
      "En cuanto los configuremos vas a poder sacar tu turno por acá.",
      1500,
    );
    return { status: "success", matched: "[turno sin agenda]" };
  }

  return handleAgendaMenu(ctx);
}
