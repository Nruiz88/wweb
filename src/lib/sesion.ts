import { cookies } from "next/headers";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdmin, getScoped } from "./db";

/* =========================================================
   Nexo Studio — Sesiones del bot
   ---------------------------------------------------------
   Sustituye al `auth.ts` de JWT + bcrypt que tenía el bot antes.

   QUÉ CAMBIÓ Y POR QUÉ
   --------------------
   Antes el bot tenía su propio sistema de usuarios: tabla `profiles`
   con `password_hash`, JWT firmado con `JWT_SECRET` y una cookie
   `wweb_session` de 30 días. Eso significaba que un cliente del bot
   era un usuario distinto del que entraba en el panel de Nexo Studio:
   dos contraseñas, dos sesiones, dos sitios donde se puede perder el
   acceso.

   Ahora no hay usuarios propios. El usuario es el de Supabase Auth que
   yaUses el panel, y la entrada es un ticket firmado (lib/tickets.ts).

   LA COOKIE ES HOST-ONLY
   ---------------------
   Se llama `nexo_bot` y no lleva `Domain`. Es lo mismo que hace el
   panel: si compartiera dominio con el resto de subdominios, un XSS en
   CUALQUIERA de ellos se llevaría la sesión de todos, y el panel es
   donde están todos los clientes.

   POR QUÉ NO SE REUSA `sessions` DEL PANEL
   ---------------------------------------
   Cada servicio tiene su almacén. Si el bot escribiera en `sessions`,
   el panel podría leer sesiones del bot y el viceversa, que es
   exactamente lo que la cookie host-only evita.

   Y el `access_token` NO se renueva aquí: el bot no guarda
   `refresh_token`. Cuando el token de Supabase caduca (una hora), el
   usuario vuelve a pasar por el panel. Para un servicio de uso corto
   es lo simple y suficiente, y evita tener un refresh_token guardado en
   dos sitios.
   ========================================================= */

export const COOKIE_NAME = "nexo_bot";

/** Cuánto vive la sesión. Más corta que la del panel: el bot es de uso concreto. */
const HORAS_SESION = 4;

export interface Sesion {
  userId: string;
  /* El cliente de esta sesión.

     Antes era siempre el cliente y ya. Ahora sigue siendo así para
     todos, incluido el staff: cuando soporte entra en el bot de
     alguien, su sesión ES de ese cliente. La diferencia no está aquí
     sino en `rol` y en `soporteDe`, que juntos dicen "es del equipo y
     está atendiendo a este". Poner el cliente aquí es lo que hace que
     el resto del código del bot no necesite saber nada de soporte: ve
     un cliente, como siempre. */
  clientId: string;
  rol: "staff" | "client";
  accessToken: string;
  csrfToken: string;
  expiraEn: string;

  /* ── SOPORTE ────────────────────────────────────────────────
     Presentes SOLO en sesiones de staff, y SOLO cuando el staff ha
     elegido a qué cliente atiende. Son la razón por la que esa
     sesión puede ver un bot que no es suyo: la BASE comprueba esta
     columna, no el código.

     Que el mismo registro diga a quién atiende y si es soporte no es
     redundancia. `rol` dice QUIÉN es (el del equipo); `soporteDe`
     dice sobre QUIÉN está trabajando. Con los dos juntos se puede
     preguntar quién tocó la configuración de un cliente y obtener
     una respuesta. Por eso el bot enseña una banda de "estás
     viendo el bot de X" en vez de disimularlo. */

  /** Cliente que esta sesión de staff atiende. */
  soporteDe?: string | null;

  /** Por qué entra. Nunca vacío si hay sesión de soporte. */
  soporteMotivo?: string | null;
}

/**
 * El bot de este cliente, o null si no tiene ninguno.
 *
 * ── POR QUÉ ESTA ES LA FRONTERA DE SEGURIDAD ──
 *
 * El cliente de Supabase que usa esta función lleva el access_token del
 * usuario, así que RLS DECIDE qué filas ve. Un cliente solo ve su
 * propio bot, porque así lo dice la política `leer su bot` de la
 * migración 011.
 *
 * Por eso el `id` que sale de aquí es de fiar: no es el id que venga
 * en la URL, que es un dato sin verificar.
 *
 * ── POR QUÉ EXISTE, SI RLS YA PROTEGE ──
 *
 * Porque el resto del código de estas rutas sigue usando `query()`, que
 * va por la secret key y salta RLS. Esa mezcla es la trampa:
 *
 *   const botId = await botDeLaSesion(sesion);   ← con RLS, de fiar
 *   const filas = await query("SELECT ... WHERE bot_id = ?", [botId]);
 *
 * es correcto porque el id viene de un SELECT que RLS ya filtró. Lo
 * que NO sería correcto es aceptar el id desde la petición:
 *
 *   const botId = searchParams.get("instanceId");   ← NUNCA
 *
 * Antes esa comprobación era `verifyUserAccess(userId, instanceId)`, que
 * hacía dos consultas a MariaDB. Ya no está: es esta función la que
 * decide de qué bot se trata, y decide con RLS, no con código.
 *
 * ⚠️  EL REGLA PARA LAS RUTAS QUE USAN `query()`
 * El `bot_id` SIEMPRE viene de aquí. Nunca de la URL.
 */
export async function botDeLaSesion(sesion: Sesion): Promise<{ id: string; slug: string } | null> {
  /* Si el access_token de la sesión caducó, no hay cliente con RLS y no
     se puede decidir nada. Se devuelve null en vez de tirar, para que
     la ruta responda 401 y no 500. El usuario vuelve por el panel. */
  const db = clienteDeLaSesion(sesion);
  if (!db) return null;

  const { data, error } = await db
    .from("bots")
    .select("id, slug")
    .eq("client_id", sesion.clientId)
    .maybeSingle();

  if (error) {
    console.error("[sesion] botDeLaSesion:", error.message);
    return null;
  }

  return data ? { id: data.id, slug: data.slug } : null;
}

function aleatorio(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Crea una sesión para un cliente que acaba de pasar por el ticket.
 *
 * El token en claro se devuelve para ponerlo en la cookie y NO se
 * guarda: en la tabla solo va su hash. Si alguien lee `bot_sesiones`
 * puede invalidar una sesión, no suplantarla.
 */
export async function crearSesion(params: {
  userId: string;
  /* NULL solo para staff. En ese momento la sesión existe pero no da
     acceso a ningún bot: la base no concede nada sin `soporteDe`. */
  clientId: string | null;
  rol: "staff" | "client";
  accessToken: string;
  /** Cliente al que atiende. Solo staff, y obligatorio si viene. */
  soporteDe?: string | null;
  /** Motivo de la entrada. Obligatorio si hay soporteDe. */
  soporteMotivo?: string | null;
}): Promise<{ token: string; csrfToken: string; expiraEn: string }> {
  const token = aleatorio(32);
  const csrfToken = aleatorio(24);
  const expiraEn = new Date(Date.now() + HORAS_SESION * 3600 * 1000).toISOString();

  /* El motivo se comprueba AQUÍ y no en la ruta que llama. Que el
     motivo no pueda dejarse en blanco es una propiedad de la sesión,
     y ponerlo en el punto de creación significa que ninguna ruta
     nueva pueda olvidarlo. */
  if (params.soporteDe && !params.soporteMotivo?.trim()) {
    throw new Error("Una sesión de soporte necesita un motivo.");
  }

  const { error } = await getAdmin().from("bot_sesiones").insert({
    token_hash: hash(token),
    user_id: params.userId,
    client_id: params.clientId,
    rol: params.rol,
    access_token: params.accessToken,
    csrf_token: csrfToken,
    expira_en: expiraEn,
    soporte_de: params.soporteDe ?? null,
    soporte_motivo: params.soporteMotivo ?? null,
    soporte_abierto_en: params.soporteDe ? new Date().toISOString() : null,
  });

  if (error) throw new Error("No se pudo crear la sesión: " + error.message);

  return { token, csrfToken, expiraEn };
}

/**
 * Lee la sesión de la cookie.
 *
 * Devuelve null si no hay, si caducó o si se revocó. No lanza: la
 * ausencia de sesión es lo normal en casi todas las peticiones.
 */
export async function leerSesion(token?: string | null): Promise<Sesion | null> {
  if (!token) return null;

  const { data, error } = await getAdmin()
    .from("bot_sesiones")
    .select(
      "user_id, client_id, rol, access_token, csrf_token, expira_en, revocado_en, soporte_de, soporte_motivo"
    )
    .eq("token_hash", hash(token))
    .maybeSingle();

  if (error || !data) return null;
  if (data.revocado_en) return null;
  if (new Date(data.expira_en).getTime() <= Date.now()) return null;

  return {
    userId: data.user_id,
    clientId: data.client_id,
    rol: data.rol,
    accessToken: data.access_token,
    csrfToken: data.csrf_token,
    expiraEn: data.expira_en,
    soporteDe: data.soporte_de,
    soporteMotivo: data.soporte_motivo,
  };
}

/** La sesión de la petición actual, o null. */
export async function getSession(): Promise<Sesion | null> {
  const store = await cookies();
  return leerSesion(store.get(COOKIE_NAME)?.value);
}

/** Cierra la sesión. Idempotente: revocar una sesión ya revocada no falla. */
export async function cerrarSesion(token?: string | null): Promise<void> {
  if (!token) return;
  await getAdmin()
    .from("bot_sesiones")
    .update({ revocado_en: new Date().toISOString() })
    .eq("token_hash", hash(token));
}

/**
 * El cliente de Supabase de ESTE usuario, con su token.
 *
 * Es el que tienen que usar las rutas y las páginas del panel del bot:
 * pasa por RLS, no por la secret key.
 *
 * Si el token de la sesión caducó (una hora de vida, y la sesión vive 4),
 * esto NO lo arregla. Se devuelve null y quien llama manda al panel a
 * renovarla. Preferible a refrescar en silencio: un refresh token aquí
 * sería un segundo sitio donde guardar uno.
 */
export function clienteDeLaSesion(sesion: Sesion): SupabaseClient | null {
  if (!sesion.accessToken) return null;
  return getScoped(sesion.accessToken);
}

/**
 * Exige sesión. Para las páginas y rutas del panel del bot.
 *
 * Redirige a la entrada en vez de devolver un 401, porque quien está
 * sin sesión es una persona que acaba de pulsar un enlace, no una
 * máquina.
 */
export async function exigeSession(origen = "/"): Promise<Sesion> {
  const sesion = await getSession();

  if (!sesion) {
    const destino = encodeURIComponent(origen);
    throw new Error(`SIN_SESION:${destino}`);
  }

  /* Se comprueba la suscripción en CADA petición, no solo al entrar.
     Si alguien cancela con el navegador ya abierto, tiene que dejar de
     funcionar en la siguiente llamada, no cuando le dé la gana. Es una
     consulta a una tabla de una fila.

     Se hace con la secret key a propósito: es una comprobación de
     NEGOCIO ("¿tiene el producto contratado?"), no de datos. Los
     DATOS del cliente siempre van por RLS. */
  if (!sesion.soporteDe && !(await tieneElModulo(sesion.clientId, "bot_whatsapp"))) {
    throw new Error("SIN_SUSCRIPCION");
  }

  return sesion;
}

/** ¿Esta sesión es de soporte? Es decir, staff atendiendo a un cliente. */
export function esSesionDeSoporte(sesion: Sesion): boolean {
  return sesion.rol === "staff" && Boolean(sesion.soporteDe);
}

/** ¿Este cliente tiene el bot contratado y al día? */
export async function tieneElModulo(clientId: string, moduleId: string): Promise<boolean> {
  if (!clientId || !moduleId) return false;
  const { data, error } = await getAdmin().rpc("tiene_modulo", {
    cliente_uuid: clientId,
    modulo: moduleId,
  });
  if (error) {
    console.error("[sesion] tiene_modulo falló:", error.message);
    return false;
  }
  return data === true;
}