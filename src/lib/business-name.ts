import { query } from "@/lib/db";

/**
 * Nombre del negocio para personalizar los mensajes del bot.
 *
 * Antes los pies de página de la agenda y de los recordatorios tenían
 * "Boti" hardcodeado, que es el nombre del PRODUCTO: le mostrábamos al cliente
 * final el nombre de la plataforma en vez del negocio que lo atiende.
 *
 * Resuelve `profiles.business_name` del dueño de la instancia, con fallback a
 * `instance_name` y por último a un genérico.
 *
 * Cacheado en memoria 5 min por instancia: se llama en cada mensaje y no vale
 * la pena pegarle a la BD cada vez. En Coolify el contenedor es único, así que
 * el cache sirve; si algún día hay varias réplicas, pasar a Redis o aceptarlo
 * como cache "best effort" (el nombre cambia muy pocas veces).
 */
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { name: string; at: number }>();

export async function getBusinessName(instanceId: string, instanceName: string): Promise<string> {
  const hit = cache.get(instanceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.name;

  let name = "";
  try {
    const rows = await query<{ business_name: string | null }>(
      `SELECT p.business_name
       FROM instances i JOIN profiles p ON p.id = i.admin_id
       WHERE i.id = ? LIMIT 1`,
      [instanceId]
    );
    name = (rows?.[0]?.business_name ?? "").trim();
  } catch (e) {
    // Nunca romper un mensaje por no poder leer el nombre.
    console.error("[business-name] no se pudo resolver", {
      instanceId,
      message: e instanceof Error ? e.message : String(e),
    });
  }

  const resolved = name || instanceName?.trim() || "Tu negocio";
  cache.set(instanceId, { name: resolved, at: Date.now() });
  return resolved;
}

/** Limpia la cache (para tests o si el negocio cambia de nombre). */
export function clearBusinessNameCache(instanceId?: string) {
  if (instanceId) cache.delete(instanceId);
  else cache.clear();
}
