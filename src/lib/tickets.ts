import crypto from "crypto";

/* =========================================================
   Nexo Studio — Verificación de tickets de acceso
   ---------------------------------------------------------
   Réplica de `lib/tickets.js` del panel (D:\webs\empresa), pero solo
   la mitad de verificación: el bot NUNCA firma tickets, solo los
   valida. La firma la hace siempre el panel.

   El formato tiene que ser IDÉNTICO al del panel o nada funcionaría:
     <base64url(payload)>.<base64url(HMAC-SHA256(payload))>

   Por qué hay ticket y no cookie compartida está escrito en el panel
   (lib/acceso-servicio.js): la cookie del panel es host-only a
   propósito, y compartirla con Domain=.midominio.com haría que un XSS
   en cualquier subdominio se llevara la sesión de todos.

   OJO CON EL SECRET
   -----------------
   `SERVICE_SECRET` tiene que ser el MISMO en los dos servicios y
   distinto de `SESSION_SECRET`. Si compartieran secreto, una firma
   válida del panel valdría como cookie de sesión del bot.
   ========================================================= */

/** Cuánto margen se deja al token de Supabase que va dentro del ticket. */
const MARGEN_TOKEN_MS = 2 * 60 * 1000;

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

function firma(cuerpo: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(cuerpo).digest("base64url");
}

/** Comparación en tiempo constante, sin filtrar por longitud. */
function comparacionSegura(a: string, b: string): boolean {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export interface TicketPayload {
  uid: string;
  cid: string | null;
  rol: "staff" | "client";
  sid: string | null;
  at: string;
  exp: number;
  jti: string;
}

/**
 * Valida un ticket. NO lanza: devuelve null si algo no cuadra.
 *
 * Que devuelva null en vez de lanzar es a propósito: un ticket
 * manipulado es un evento NORMAL (alguien que cambia un carácter por
 * curiosidad, un escáner, un enlace caducado). Quien llama decide qué
 * hacer con eso.
 */
export function verificar(ticket: string, secret?: string): TicketPayload | null {
  const clave = (secret ?? process.env.SERVICE_SECRET ?? "").trim();
  if (!clave) return null;
  if (!ticket || typeof ticket !== "string") return null;

  const corte = ticket.lastIndexOf(".");
  if (corte < 1) return null;

  const cuerpo = ticket.slice(0, corte);
  const firmaRecibida = ticket.slice(corte + 1);
  if (!firmaRecibida) return null;

  /* La firma se comprueba ANTES de mirar el contenido. Si no, alguien
     podría mandar un payload arbitrario y que lo deserialicemos antes
     de comprobar nada. */
  if (!comparacionSegura(firmaRecibida, firma(cuerpo, clave))) return null;

  let payload: TicketPayload;
  try {
    payload = JSON.parse(b64urlDecode(cuerpo).toString("utf8"));
  } catch {
    return null;
  }

  /* Comprobaciones de forma. Que la firma cuadre no significa que el
     contenido sea lo que creemos: alguien con el secret podría haber
     firmado otra cosa. */
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.uid !== "string" || !payload.uid) return null;
  if (payload.rol !== "staff" && payload.rol !== "client") return null;
  if (typeof payload.exp !== "number") return null;
  if (payload.rol === "client" && (typeof payload.cid !== "string" || !payload.cid)) return null;

  /* Caducado. Con 5 s de margen: un ticket que expira justo mientras
     el bot lo procesa no sirve de nada. */
  if (payload.exp + 5 < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

/** El access_token que va dentro del ticket, para reconstruir la sesión. */
export const tokenDe = (payload: TicketPayload): string => payload.at;

/**
 * ¿Caduca pronto el access_token?
 *
 * El panel lo comprueba ANTES de firmar. Aquí no hace falta porque no
 * firmamos, pero se deja exportado por si el bot llega a firmar algo
 * (por ejemplo un enlace de descarga), donde el mismo error aparecería
 * igual: un token a punto de expirar produce un error que no explica el
 * motivo.
 */
export function tokenPorExpirar(accessToken: string, margenMs = MARGEN_TOKEN_MS): boolean {
  if (!accessToken) return true;
  try {
    const partes = String(accessToken).split(".");
    if (partes.length !== 3) return true;
    const payload = JSON.parse(b64urlDecode(partes[1]).toString("utf8"));
    if (!payload.exp) return true;
    return payload.exp * 1000 - Date.now() < margenMs;
  } catch {
    /* Si no se puede leer, se asume caducado: mejor renovar de más. */
    return true;
  }
}