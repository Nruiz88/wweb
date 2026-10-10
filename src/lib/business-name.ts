import { query } from "@/lib/db";

/**
 * Nombre del negocio para personalizar los mensajes del bot.
 *
 * Antes los pies de página de la agenda y de los recordatorios tenían
 * "Boti" hardcodeado, que es el nombre del PRODUCTO: le mostrábamos al cliente
 * final el nombre de la plataforma en vez del negocio que lo atiende.
 *
 * El nombre del negocio ahora vive en `clients.nombre`: un bot es de un
 * cliente de Nexo Studio, no de un "usuario" con un perfil propio.
 *
 * OJO con el primer argumento. Todos los que llaman a esta función pasan
 * `instance.id` de la fila que les resolvió el webhook, y esa fila es de
 * **`bots`** (con `client_id`), no de la tabla `instances` de antes. La
 * consulta vieja (`instances JOIN profiles`) no solo usaba tablas que ya no
 * existen: además el `WHERE i.id` comparaba un id de bot contra una tabla
 * donde nunca iba a estar. El `try/catch` convertía el error en silencio y
 * el nombre salía siempre como fallback, o sea que TODOS los mensajes del
 * bot decían "Boti 1" en vez del nombre del comercio.
 *
 * Cacheado en memoria 5 min por bot: se llama en cada mensaje y no vale la
 * pena pegarle a la BD cada vez. En Coolify el contenedor es único, así que
 * el cache sirve; si algún día hay varias réplicas, pasar a Redis o aceptarlo
 * como cache "best effort" (el nombre cambia muy pocas veces).
 */
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { name: string; at: number }>();

/** `botId` es el id de la fila de `bots`, no el de `instances`. */
export async function getBusinessName(botId: string, instanceName: string): Promise<string> {
  const hit = cache.get(botId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.name;

  let name = "";
  try {
    const rows = await query<{ nombre: string | null }>(
      `SELECT c.nombre
         FROM bots b JOIN clients c ON c.id = b.client_id
        WHERE b.id = ? LIMIT 1`,
      [botId]
    );
    name = (rows?.[0]?.nombre ?? "").trim();
  } catch (e) {
    // Nunca romper un mensaje por no poder leer el nombre.
    console.error("[business-name] no se pudo resolver", {
      botId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const resolved = name || instanceName?.trim() || "Tu negocio";
  cache.set(botId, { name: resolved, at: Date.now() });
  return resolved;
}

/** Limpia la cache (para tests o si el negocio cambia de nombre). */
export function clearBusinessNameCache(botId?: string) {
  if (botId) cache.delete(botId);
  else cache.clear();
}