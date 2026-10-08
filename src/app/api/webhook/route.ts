import { NextResponse } from "next/server";
import { query, getAdmin } from "@/lib/db";
import { getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { verifyWebhookSignature } from "@/lib/webhook-secret";
import { extractMessageText, extractButtonText, extractListText, extractRawButtonId } from "@/lib/webhook/extract";
import { createBotDb, type WebhookContext } from "@/lib/webhook/context";
import { handleWelcome } from "@/lib/webhook/welcome";
import { handleOutsideHours } from "@/lib/webhook/outside-hours";
import { handleBookingIntent, handleDateSelect, handleSlotSelect, handleAppointmentConfirm, handleAgendaMenu, handleNumericSlotSelect, handleSlotsMore, isAgendaActive } from "@/lib/webhook/booking";
import { handleMenuTap, handleMenuTextReply } from "@/lib/webhook/menus";
import { handleAutoReply } from "@/lib/webhook/auto-reply";
import { handleCatalogIntent, handleCatalogPage } from "@/lib/webhook/catalog";

export const dynamic = "force-dynamic";

interface WebhookPayload {
  event: string;
  instance: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string; participant?: string };
    message?: Record<string, unknown>;
    pushName?: string;
    messageTimestamp?: number;
    id?: string;
    participant?: string;
    action?: "add" | "remove";
  };
}

// `query()` devuelve el array de filas directamente (va a `ejecutar_sql`).
// Antes venía de mysql2 y el código hacía `const [{ rows }]`, que con el
// wrapper actual daba `undefined` y reventaba cada webhook. Esta función se
// queda como normalización por si algún día `query()` devuelve otra cosa: los
// handlers no deberían tener que comprobarlo.
async function select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const rows = await query<T>(sql, params);
  return Array.isArray(rows) ? rows : [];
}

// Nota: `update()` se eliminó. Era código muerto (nadie lo llamaba) y con la
// nueva firma de `query` pedía tipos que no existen. Para UPDATE/DELETE usar
// `exec()` de "@/lib/db".

/**
 * Auditoría durable del webhook.
 *
 * Los `console.log` solo viven en el stdout del contenedor (panel de Coolify),
 * que rota y no se puede consultar después. `bots_webhook_logs` es el único
 * lugar donde queda registro de qué pasó con cada mensaje.
 *
 * ANTES esta función no escribía NADA, por dos motivos a la vez:
 *
 *   - apuntaba a `webhook_logs`, que no existe. La tabla se llama
 *     `bots_webhook_logs` (migración 011), como las demás del bot, para no
 *     chocar con el vocabulario de Nexo Studio. Usaba además
 *     `error_message` en vez de `error`, y `NOW()` en vez de `now()`.
 *   - y escribía con `query()`, que va a `ejecutar_sql`, que solo admite
 *     SELECT. Toda escritura por ahí se rechaza, a propósito.
 *
 * Los dos fallos caían dentro del `try`, así que el `catch` los se tragaba y
 * el webhook seguía funcionando en silencio. Parecía auditable y no lo era:
 * `bots_webhook_logs` salía vacía siempre, y sin logs de runtime no había
 * forma de saber si un mensaje había pasado o no.
 *
 * Ahora escribe con el cliente de servicio, que sí puede insertar, sobre la
 * tabla y las columnas que existen de verdad.
 *
 * Nunca debe romper el flujo: si la auditoría falla, el bot responde igual.
 * El `console.error` deja rastro en los logs del contenedor.
 */
async function logWebhook(
  eventType: string,
  status: "processed" | "failed" | "skipped",
  opts: { instanceId?: string | null; payload?: unknown; error?: string | null } = {},
) {
  try {
    await getAdmin().from("bots_webhook_logs").insert({
      event_type: String(eventType).slice(0, 255),
      bot_id: opts.instanceId ?? null,
      payload: opts.payload ?? null,
      status,
      error: opts.error ? String(opts.error).slice(0, 2000) : null,
    });
  } catch (e) {
    console.error("[webhook] no se pudo auditar", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Snapshot acotado del payload para no guardar megabytes ni PII sensible. */
function auditPayload(body: WebhookPayload) {
  return {
    instance: body?.instance,
    remoteJid: body?.data?.key?.remoteJid,
    fromMe: body?.data?.key?.fromMe,
    text: String(
      (body?.data?.message as Record<string, unknown> | undefined)?.conversation ??
        (body?.data?.message as Record<string, unknown> | undefined)?.extendedTextMessage ?? ""
    ).slice(0, 300),
  };
}

/**
 * Responde Y audita. Todos los retornos de handler pasan por acá, así
 * `webhook_logs.status` + `payload.matched` muestran qué handler matcheó y con
 * qué texto — la forma de saber si el bot respondió "turno" sin tener logs
 * de runtime.
 *
 * `plan` ya no está en el contexto ni se guarda en el log. Siempre valía
 * `"pro"` porque el valor se fijaba a mano, así que el campo solo ocupaba
 * sitio: quien mirara los logs veía "pro" incluso para un cliente al que
 * de hecho no le correspondía.
 */
async function reply(
  result: { status: string; matched?: string } | null,
  ctx: { instance: { id: string }; effectiveText: string; remoteJid: string; isLid: boolean },
) {
  await logWebhook(result ? "handler_matched" : "no_handler_matched", "processed", {
    instanceId: ctx.instance.id,
    payload: {
      text: ctx.effectiveText.slice(0, 300),
      matched: result?.matched ?? null,
      status: result?.status ?? null,
      from: ctx.remoteJid,
      isLid: ctx.isLid,
    },
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  // Sin esto, cualquier excepción en un handler (columna inexistente, BD caída,
  // Evolution en timeout) devolvía un 500 sin log y el usuario veía silencio total.
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("[webhook] error no manejado", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ status: "error", error: "Internal error" }, { status: 500 });
  }
}

/**
 * Normaliza el nombre del evento de Evolution.
 *
 * ESTO ERA LA RAZÓN DE QUE EL BOT NO RESPONDIERA NADA EN PRODUCCIÓN.
 *
 * El dispatcher comparaba `body.event !== "messages.upsert"` en minúsculas y
 * con punto. Pero Evolution 2.3.7 (la versión que corre en el server) manda
 * los eventos en SCREAMING_SNAKE: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`,
 * `GROUP_PARTICIPANTS_UPDATE`. La comparación no daba nunca, así que TODO
 * mensaje real caía en la rama de "ignorado" y se devolvía 200 sin hacer nada:
 * el bot no respondía ni una palabra, y el usuario veía silencio.
 *
 * Las pruebas no lo detectaban porque `test-webhook.js` fabricaba el payload a
 * mano con `event: "messages.upsert"` — o sea, la prueba se mandaba a sí misma
 * el evento que la realidad no manda. Por eso las 21 comprobaciones pasaban
 * mientras el bot estaba mudo. Ahora hay una comprobación con `MESSAGES_UPSERT`.
 *
 * Se aceptan todas las variantes: `messages.upsert`, `MESSAGES_UPSERT`,
 * `messages-upsert`... El separador se unifica a `_` y se pasa a minúsculas.
 */
function nombreEvento(evento: unknown): string {
  return String(evento ?? "").trim().toLowerCase().replace(/[.\s-]+/g, "_");
}

async function handleWebhook(request: Request) {
  // OJO: la clave por defecto es la IP, y todas las instancias de Evolution
  // salen desde el mismo servidor → el límite era compartido. Con 100/min un
  // pico de varios números a la vez saturaba y el bot devolvía 429 (silencio).
  const rateLimitErr = await rateLimitResponse(request, "webhook", { maxRequests: 600, windowMs: 60_000 });
  if (rateLimitErr) {
    await logWebhook("rate_limited", "skipped", { payload: { ip: getClientIp(request) } });
    return rateLimitErr;
  }

  let rawBody: string;
  try { rawBody = await request.text(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 });
  }

  if (!(await verifyWebhookSignature(request, rawBody))) {
    console.warn("[webhook] firma invalida", { ip: getClientIp(request) });
    await logWebhook("invalid_signature", "skipped", { payload: { ip: getClientIp(request), body: rawBody.slice(0, 2000) } });
    return NextResponse.json({ status: "error", error: "Invalid signature" }, { status: 401 });
  }

  let body: WebhookPayload;
  try { body = JSON.parse(rawBody) as WebhookPayload; } catch {
    await logWebhook("invalid_json", "failed", { payload: { body: rawBody.slice(0, 2000) } });
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  // Community features removed — ignore group events and group messages
  const evento = nombreEvento(body.event);

  if (evento === "group_participants_update") {
    return NextResponse.json({ status: "ignored" });
  }

  // Only process incoming messages from here
  if (evento !== "messages_upsert") {
    // Se loguea el nombre CRUDO a propósito: si aparece uno raro en producción,
    // en la tabla está tal cual lo mandó Evolution, sin normalizar.
    await logWebhook(String(body.event || "unknown"), "skipped", { payload: auditPayload(body) });
    return NextResponse.json({ status: "ignored" });
  }
  if (body.data?.key?.fromMe) return NextResponse.json({ status: "ignored" });

  const instanceName = body.instance;
  const remoteJid = body.data?.key?.remoteJid || "";
  if (remoteJid.includes("@g.us")) {
    return NextResponse.json({ status: "ignored" });
  }
  const plainText = extractMessageText(body.data?.message);
  const buttonText = extractButtonText(body.data?.message);
  const listText = extractListText(body.data?.message);
  const effectiveText = plainText || buttonText || listText;

  if (!instanceName || !remoteJid || !effectiveText) {
    // Es el corte más silencioso de todos: si `extractMessageText` no reconoce
    // la forma del mensaje (viewOnce, ephemeral, string plano...) el bot no
    // responde y antes no quedaba registro de nada.
    await logWebhook("no_extractable_text", "skipped", { payload: { ...auditPayload(body), rawMessage: JSON.stringify(body?.data?.message ?? null).slice(0, 1500) } });
    return NextResponse.json({ status: "ignored" });
  }

  // ============================================================
  // DM MESSAGES → load instance + plan + shared context
  // ============================================================
  /* ------------------------------------------------------------------
     El bot, con los datos de SU SERVIDOR de Evolution resueltos.

     El join a `evolution_servers` es lo que hace posible el fix de
     seguridad: `evolution_api_url` y `evolution_api_key` ya no están en
     la fila del bot. Con varias instancias (bots de distintos clientes)
     compartiendo servidor, tener la clave en la fila del cliente
     significaba que ese cliente podía leerla y manejar los bots de los
     demás. Aquí la clave sale de una tabla sin políticas RLS, a la que
     solo llega el servidor.

     El plan desaparece entero (con `user_instances`, `subscriptions` y
     `plan_type`): ahora decide Nexo Studio, en su tabla
     `suscripciones`. El bot solo entra si le llega un mensaje.

     OJO sobre RLS: esto va con la secret key, que la salta. La única
     garantía de que este webhook es de verdad el de Evolution es la
     firma que se comprueba más arriba en el fichero.
     ------------------------------------------------------------------ */
  const instancias = await query<{
    id: string;
    client_id: string;
    slug: string;
    instance_name: string;
    welcome_message: string | null;
    outside_hours_message: string | null;
    evolution_api_url: string;
    evolution_api_key: string;
    evolution_api_token: string | null;
  }>(
    `SELECT b.id, b.client_id, b.slug, b.instance_name, b.welcome_message, b.outside_hours_message,
            s.url AS evolution_api_url, s.api_key AS evolution_api_key,
            b.instance_token AS evolution_api_token
       FROM bots b
       JOIN evolution_servers s ON s.id = b.server_id
      WHERE b.instance_name = ?
      LIMIT 1`,
    [instanceName]
  );

  if (instancias.length === 0) {
    console.error("[webhook] bot no encontrado", { instance: instanceName, from: remoteJid });
    await logWebhook("instance_not_found", "failed", { payload: { instance: instanceName, from: remoteJid } });
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const instance = instancias[0];

  /* ───────────────────────────────────────────────────────────────────
     CON QUÉ CLAVE SE MANDA A EVOLUTION
     ───────────────────────────────────────────────────────────────────

     Antes se usaba siempre `evolution_api_key`, que es la clave GLOBAL de
     la caja: la que entra a TODAS las instancias. Con un solo bot no se
     nota. Con el segundo, el bot de un cliente puede leer los chats, el
     número y el webhook del otro: son datos de un negocio que el panel
     no debería poder ni leer.

     Ahora se prefiere el token de la INSTANCIA, que solo ve la suya.
     Comprobado en la caja de producción:

       · clave global   -> /instance/fetchInstances devuelve todas
       · token instancia -> devuelve solo la propia
       · token instancia -> envía mensajes (HTTP 201, comprobado de verdad)

     Y si el token no está, se cae a la clave global. Eso es lo que hace
     que la migración sea reversible: con la columna en NULL el bot se
     comporta exactamente como antes, en vez de quedarse mudo.

     ── POR QUÉ NO SE USA EL TOKEN PARA LEER ──

     Porque la lectura de la instancia la hace esta misma consulta, en SQL,
     contra la base. La clave de Evolution no interviene. El token solo se
     usa para hablar con la caja, que es donde el aislamiento importa.
     */
  const tokenDeInstancia = (instancias[0].evolution_api_token || "").trim();
  const claveDeLaCaja = tokenDeInstancia || instancias[0].evolution_api_key;

  if (!tokenDeInstancia) {
    /* No es un error: es el estado de antes del cambio. Se avisa una vez
       por instancia para que quede en el log sin ser un ruido por
       mensaje, que sería miles de líneas al día. */
    console.warn(
      "[webhook] el bot " + instance.id + " no tiene token de instancia: " +
        "se usa la clave global, que ve todas las instancias"
    );
  }

  instance.evolution_api_key = claveDeLaCaja;

  /* No hay plan que calcular. Se deja la variable con un valor fijo
     porque hay console.log de diagnóstico que la imprimen, y quitarlos
     sería tocar código que funciona. Cuando PlanType deje de existir
     del todo, esto se borra junto con esos logs. */

  // OJO: en DMs, Evolution 2.3.5+ puede mandar el JID como <lid>@lid, que NO
  // es un teléfono. Si eso pasa, el `number` que le pasamos a sendText es un LID
  // y Evolution no lo entrega. Se deja el log con el número derivado para poder
  // confirmarlo en producción.
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@lid", "");

  // Log DM messages that look like booking intents to diagnose plan resolution
  if (effectiveText && /(turno|agenda|agendar|reservar|cita)/i.test(effectiveText)) {
    console.log("[webhook] booking intent dm", {
      instance: instanceName,
      from: remoteJid,
      to: phoneNumber,
      isLid: remoteJid.endsWith("@lid"),
      text: effectiveText.slice(0, 40),
    });
  }

  /* Pre-fetch auto-responses (shared across handlers)

     El `user_id` que se pedía aquí era de cuando las respuestas eran de un
     usuario, en la tabla `responses` de MariaDB. En `bots_responses` (migración
     011) no existe esa columna: las respuestas son del bot. Pedirla hacía que
     Postgres tirara `column "user_id" does not exist`, el error lo cogía el
     `catch` de abajo y la ruta devolvía 500.

     Es decir: NINGÚN webhook con mensaje de texto funcionaba. No es que
     fallara una función concreta: el pre-fetch ocurre antes de todos los
     handlers, así que el bot no respondía ni reservas, ni
     menús, ni bienvenida. Fallaba entero. */
  const autoResponses = await select<{
    id: string; keyword: string | null; regex_pattern: string | null;
    response_text: string; response_type: string; menu_config: any | null;
    response_media_url: string | null; priority: number; schedule: any | null;
  }>(
    "SELECT id, keyword, regex_pattern, response_text, response_type, menu_config, response_media_url, priority, schedule FROM bots_responses WHERE bot_id = ? AND is_active = true ORDER BY priority DESC",
    [instance.id]
  );

  // Build shared context
  const ctx: WebhookContext = {
    // BUG CRÍTICO: antes se inyectaba `{ query, pool: { execute: query } }`, un
    // objeto SIN `.from()`. Todos los handlers hacen `ctx.supabase.from(...)`,
    // así que reventaba con "ctx.supabase.from is not a function" → 500 y el bot
    // NUNCA respondía (ni "turno", ni auto-respuestas, ni menú, ni bienvenida).
    supabase: createBotDb(),
    instance, instanceName, remoteJid, phoneNumber,
    effectiveText, buttonText, listText,
    pushName: body.data?.pushName,
    messageId: body.data?.key?.id,
    senderJid: body.data?.key?.participant,
    rawButtonId: extractRawButtonId(body.data?.message) || undefined,
    autoResponses: autoResponses || [],
  };

  // Contexto de auditoría para `reply()`: identifica qué se procesó y si el
  // remitente vino como LID (que no es un teléfono y Evolution no lo entrega).
  const replyCtx = {
    instance: { id: instance.id },
    effectiveText,
    remoteJid,
    isLid: remoteJid.endsWith("@lid"),
  };

  // Plain-text menu navigation (Evolution 2.3.7 button fallback):
  // if a menu is active, "1"/"2"/"3" picks an option and "0"/"volver" goes back.
  // Runs before booking so numeric replies don't clash with the agenda.
  if (!buttonText && !listText) {
    const menuTextResult = await handleMenuTextReply(ctx);
    if (menuTextResult) return reply(menuTextResult, replyCtx);
  }

  // ============================================================
  // PRO features: appointment booking flow
  // ============================================================
  // ============================================================
  // Agenda de turnos (confirmar/cancelar, elegir horario, reservar)
  // ============================================================
  //
  // Antes esto estaba dentro de `if (hasPlan(userPlan, "pro"))`. Ese
  // gate era siempre true (hasPlan devuelve true sin mirar nada) desde
  // que los planes pasaron a Nexo Studio, así que solo añadía una
  // indentación y la impresión de que estas funciones eran de pago.
  // Ya no hay planes aquí: o el cliente contracted el módulo y entra,
  // o no entra (lo comprueba proxy.ts).
  // Reminder confirm/cancel: confirm_<id> or cancel_<id>
  const rawBtnId = extractRawButtonId(body.data?.message);
  const checkId = rawBtnId || effectiveText;

  if (checkId.startsWith("confirm_") || checkId.startsWith("cancel_")) {
    ctx.effectiveText = checkId;
    const result = await handleAppointmentConfirm(ctx);
    if (result) return reply(result, replyCtx);
  }

  // Slot selection: slot_<date>_<time>
  if (checkId.startsWith("slot_") && !checkId.startsWith("slots_more_")) {
    ctx.effectiveText = checkId;
    const result = await handleSlotSelect(ctx);
    if (result) return reply(result, replyCtx);
  }

  // Paginación del listado de horarios: slots_more_<date>_<offset>
  if (checkId.startsWith("slots_more_")) {
    ctx.effectiveText = checkId;
    const result = await handleSlotsMore(ctx);
    if (result) return reply(result, replyCtx);
  }

  // Numeric reply to a text menu (e.g. "2" for a slot previously shown)
  const numericResult = await handleNumericSlotSelect(ctx);
  if (numericResult) return reply(numericResult, replyCtx);

  // Date selection: date_<YYYY-MM-DD>
  if (checkId.startsWith("date_")) {
    ctx.effectiveText = checkId;
    const result = await handleDateSelect(ctx);
    if (result) return reply(result, replyCtx);
  }

  // Agenda menu: agenda_hoy / agenda_proximo / agenda_completa
  // (also matches plain-text replies: "1", "hoy", "próximo", "completa", etc.)
  const menuTextMatch = checkId.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
  if (
    await isAgendaActive(ctx) &&
    (checkId === "agenda_hoy" || checkId === "agenda_proximo" || checkId === "agenda_completa" ||
    ["1", "hoy", "librehoy", "2", "proximo", "masproximo", "3", "completa", "agendacompleta"].includes(menuTextMatch))
  ) {
    ctx.effectiveText =
      checkId === "1" || menuTextMatch === "hoy" || menuTextMatch === "librehoy" ? "agenda_hoy"
      : checkId === "2" || menuTextMatch === "proximo" || menuTextMatch === "masproximo" ? "agenda_proximo"
      : checkId === "3" || menuTextMatch === "completa" || menuTextMatch === "agendacompleta" ? "agenda_completa"
      : checkId;
    const result = await handleAgendaMenu(ctx);
    if (result) return reply(result, replyCtx);
  }

  // Booking intent: "turno", "agendar", etc.
  const result = await handleBookingIntent(ctx);
  if (result) return reply(result, replyCtx);

  // ============================================================
  // STARTER features: welcome, outside hours, menus, auto-reply
  // ============================================================

  // Welcome message (first-time writer)
  await handleWelcome(ctx);

  // Outside hours auto-reply (stops processing if triggered)
  const outsideResult = await handleOutsideHours(ctx);
  if (outsideResult) return reply(outsideResult, replyCtx);

  // Menu button/list tap
  if (buttonText || listText) {
    const menuResult = await handleMenuTap(ctx);
    if (menuResult) return reply(menuResult, replyCtx);
  }

  // ============================================================
  // CATALOG / Pedidos genéricos ( Starter + Pro )
  // ============================================================
  const catalogResult = await handleCatalogIntent(ctx);
  if (catalogResult) return reply(catalogResult, replyCtx);

  // Regular keyword/regex matching
  const replyResult = await handleAutoReply(ctx);
  return reply(replyResult, replyCtx);
}
