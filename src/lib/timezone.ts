export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "America/Argentina/Buenos_Aires";

/** Fecha YYYY-MM-DD de "hoy" en zona horaria del negocio (default Buenos Aires) */
export function todayInBusinessTimezone(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hora HH:MM en zona horaria del negocio */
export function timeInBusinessTimezone(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** Date object interpretado como fecha en zona negocio (sin desfase UTC) */
export function parseDateInBusinessTimezone(dateStr: string): Date {
  // dateStr YYYY-MM-DD → lo tratamos como fecha local negocio, no UTC
  return new Date(`${dateStr}T12:00:00`);
}

/**
 * Formatea un Date como DATETIME de MySQL: "YYYY-MM-DD HH:MM:SS".
 *
 * NO usar `toISOString()` para comparar contra columnas TIMESTAMP/DATETIME:
 * devuelve "2026-09-27T12:00:00.000Z" y MySQL no parsea ni el sufijo `Z` ni los
 * milisegundos → la comparación da NULL y el WHERE nunca matchea
 * (warning 1292). Con esto, `/api/admin/stats` y `/api/admin/activity`
 * devolvían 0 y el gráfico de Actividad salía siempre vacío.
 *
 * Se usa UTC porque las columnas se escriben con `NOW()`, que es la hora del
 * servidor (UTC en Vercel/Coolify).
 */
export function toMySQLDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
