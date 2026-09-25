/** Formatea un precio entero en pesos argentinos: 18000 → "$18.000". */
export function formatArs(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}
