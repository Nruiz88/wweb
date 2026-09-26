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
