/* =========================================================
   Qué palabras abren la agenda de turnos
   ---------------------------------------------------------
   Vive fuera de `webhook/booking.ts` por una razón práctica: es lógica
   pura y necesita pruebas. Cuando estaba metida en el handler, el único
   modo de comprobarla era levantar el bot entero, y el resultado era que
   nadie la probaba.

   Un cliente puede sumar UNA palabra propia (`bots.booking_keyword`,
   migración 020), pero no puede reemplazar las de siempre: quien escribe
   es el cliente final del comercio, no el dueño del bot, y nadie le va a
   decir a la gente que escriba "reservá".
   ========================================================= */

/** Las que siempre funcionan. Fijas en el código a propósito. */
export const PALABRAS_AGENDA = [
  "turno",
  "agendar",
  "reservar",
  "cita",
  "appointment",
  "agenda",
] as const;

/** Minúsculas y sin tildes: "turnó", "TURNO" y "Turno" tienen que ser lo mismo. */
export function normalizarParaBuscar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Devuelve la palabra que abre la agenda dentro de `texto`, o `null`.
 *
 * `propia` es la palabra que configuró el cliente. Se compara igual que las
 * de siempre, pero se exige que tenga 2 letras: con una sola, cualquier
 * mensaje la contendría y el bot mostraría la agenda a todo lo que le
 * escriban.
 */
export function matchPalabraAgenda(
  texto: string,
  propia?: string | null
): { palabra: string; propia: boolean } | null {
  const t = normalizarParaBuscar(texto);

  const porDefecto = PALABRAS_AGENDA.find((k) => t.includes(k));
  if (porDefecto) return { palabra: porDefecto, propia: false };

  const extra = normalizarParaBuscar((propia ?? "").trim());
  if (extra.length >= 2 && t.includes(extra)) return { palabra: extra, propia: true };

  return null;
}