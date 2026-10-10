import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdmin } from "../db";

/**
 * Contexto que comparten todos los handlers del webhook.
 *
 * QUÉ CAMBIÓ Y POR QUÉ
 * --------------------
 * Antes este fichero tenía dentro un `MariaDbBuilder` de 297 líneas que
 * imitating el cliente de Supabase sobre mysql2: `from().select().eq()
 * .single()` construido a mano con SQL. Se quitó entero.
 *
 * El motivo no es que sobrara, es que ahora el cliente DE VERDAD está
 * disponible y el builder era un intermediario que además escribía con
 * SQL crudo (saltándose RLS). Con el cliente real, las políticas las
 * aplica Postgres.
 *
 * Los handlers usan `ctx.supabase.from(...)`, así que cambiar el tipo
 * de `supabase` de un builder a un `SupabaseClient` no les toca una
 * línea: la API encadenada es la misma. `await builder` también
 * funciona, porque `PostgrestBuilder` de supabase-js es thenable, que
 * es lo que hace falta para los `await supabase.from(...)...` sin
 * `.single()` al final (los hay: booking.ts:579 y 704).
 *
 *
 * ⚠️  SOBRE EL ROL QUE USA ESTE CONTEXTO
 * -------------------------------------
 * El webhook de Evolution entra SIN sesión de usuario: es Evolution quien
 * llama, no un cliente. Por eso va con la secret key y salta RLS.
 *
 * Eso significa que la única garantía de que un bot no se mezcle con
 * otro la tiene que hacer el código, en `resuelve_bots_de_webhook()`
 * (src/app/api/webhook/route.ts), que resuelve la instancia y comprueba
 * que existe. NO hay un `es_dueno_de_bot()` detrás de cada consulta
 * como la hay en el panel: aquí es una comprobación al inicio, y el
 * resto del webhook va con la sesión ya resuelta.
 *
 * Es la diferencia real entre las dos entradas: el panel lo protege
 * RLS fila a fila; el webhook entra por la puerta de atrás, con
 * credenciales de servidor, y por eso solo puede entrar por el webhook
 * (que exige la firma de Evolution) y nunca por una URL de navegador.
 */
export function createBotDb(): SupabaseClient {
  return getAdmin();
}

/* `hasPlan(actual, requerido)` desapareció con los planes.

   Devolvía `true` siempre desde que la decisión pasó a Nexo Studio, y ya
   no la importa nadie: quedaba como una puerta que parecía filtrar
   funciones y no filtraba nada. Si algún día hacen falta módulos
   distintos dentro del bot, el sitio para comprobarlo es
   `tiene_modulo()` en el panel, no un plan dentro del bot. */

/**
 * Anota en el histórico que el bot contestó algo.
 *
 * Antes esto era el mismo `INSERT INTO bots_response_logs` copiado en cinco
 * ficheros (auto-reply, menus ×2, outside-hours, welcome), cada uno con
 * su `String(Math.random()...)` para el id. Todo eso pasa a ser una
 * llamada.
 *
 * Dos cosas que cambian al venir aquí:
 *
 * · El id lo pone la base (`uuid default gen_random_uuid()`). Los cinco
 *   sitios fabricaban un id de 26 caracteres, que no era un UUID y por
 *   tanto no valía como clave foránea.
 * · Se escribe con el CLIENTE, no con SQL crudo. `query()` es de solo
 *   lectura a propósito (ver 012_ejecutar_sql.sql), así que un INSERT
 *   por ahí ya no se ejecutaría.
 *
 * Nunca lanza: si falla el registro de un mensaje que ya se envió, lo
 * que se quiere es que el bot siga contestando, no que un 500 tumbe la
 * conversación entera.
 */
export async function registrarRespuesta(
  ctx: WebhookContext,
  datos: {
    respuestaId?: string | null;
    telefono: string;
    mensaje: string;
    coincidencia: string;
  }
): Promise<void> {
  try {
    await ctx.supabase.from("bots_response_logs").insert({
      bot_id: ctx.instance.id,
      auto_response_id: datos.respuestaId ?? null,
      incoming_phone: datos.telefono,
      incoming_message: datos.mensaje,
      matched_keyword: datos.coincidencia,
    });
  } catch (e) {
    console.error("[webhook] no se pudo registrar la respuesta", {
      bot: ctx.instance.instance_name,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Contexto que recibe cada handler del webhook. */
export interface WebhookContext {
  /** Cliente de Supabase. API encadenada: `.from().select().eq()...` */
  supabase: SupabaseClient;

  /**
   * El bot, con los datos de su servidor de Evolution ya resueltos.
   *
   * `evolution_api_url` y `evolution_api_key` NO están en la tabla
   * `bots`: viven en `evolution_servers`, porque si estuvieran en la
   * fila del cliente, este podría leer la clave compartida del servidor
   * y manejar los bots de los demás clientes de ese servidor.
   *
   * Aquí se hace el join una vez, al resolver el webhook, y se deja el
   * objeto plano. Así los 2.300 líneas de los handlers no saben nada
   * del cambio: siguen leyendo `instance.evolution_api_key`.
   */
  instance: {
    id: string;
    client_id: string;
    /** URL pública de reservas: /agendar/<slug>. Único en base de datos. */
    slug: string;
    instance_name: string;
    evolution_api_url: string;
    evolution_api_key: string;
    welcome_message: string | null;
    outside_hours_message: string | null;
  };

  instanceName: string;
  remoteJid: string;
  phoneNumber: string;
  effectiveText: string;
  buttonText: string;
  listText: string;
  pushName?: string;
  messageId?: string;
  senderJid?: string;
  /** Raw selectedButtonId when the message is a button tap. */
  rawButtonId?: string;
  /** Pre-fetched auto-responses for this bot (loaded once, shared) */
  autoResponses?: AutoResponseRow[];
}

export interface AutoResponseRow {
  id: string;
  keyword: string | null;
  regex_pattern: string | null;
  response_type: string;
  menu_config: import("../../lib/db/types").MenuConfig | null;
  response_text: string;
  response_media_url: string | null;
  priority: number;
  schedule: { from?: string; to?: string } | null;
  /* Sin user_id: el "quién" es el teléfono que escribe, no el usuario
     de Nexo Studio. Ese campo ya no existe en el esquema. */
}

/** Resultado de un handler del webhook. */
export interface HandlerResult {
  status: string;
  matched?: string;
  error?: string;
}