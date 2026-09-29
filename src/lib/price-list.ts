/**
 * Parser de listas de precios pegadas.
 *
 * El objetivo es que alguien copie la lista que ya tiene (un chat de WhatsApp,
 * un papel, la descripción de un Instagram) y la pegue tal cual. Nada de
 * planillas, nada de CSV, nada de columnas.
 *
 * Ejemplos que tiene que entender:
 *   Alfajor de chocolate - 1200
 *   * Café con leche $1.200,50
 *   1. Empanada de carne: $3500
 *   - Agua mineral 500ml 800
 *   Bolo de queso —— 2.500
 *
 * Y tiene que RECHAZAR con explicación lo que no entiende, en vez de
 * inventarse un precio.
 */

export interface ParsedProduct {
  /** Nombre del producto, limpio. */
  label: string;
  /** Precio en CENTIMOS (la BD usa centavos). */
  priceCents: number;
  /** Categoría si la línea traía una, si no null. */
  category: string | null;
  /** La línea original, para que el merchant la reconozca. */
  raw: string;
  /** Número de línea (1-based) en el texto pegado. */
  line: number;
}

export interface RejectedLine {
  raw: string;
  line: number;
  reason: string;
}

export interface ParseResult {
  products: ParsedProduct[];
  rejected: RejectedLine[];
}

/**
 * Convierte un precio escrito a la argentina a centavos.
 *
 * "1.200,50" → 120050   (mil doscientos con cincuenta)
 * "1200"     → 120000
 * "$3500"    → 350000
 * "1.234.567,89" → 123456789
 *
 * La ambigüedad entre "1.200" (mil doscientos) y "1.2" (uno con dos) se
 * resuelve por posición: si el último separador es la coma, es decimal; si es
 * el punto y hay más de un punto, son miles; si hay un solo punto con
 * exactamente 3 dígitos detrás, asumimos miles (es lo que escribe un
 * argentino).
 */
export function parsePriceToCents(raw: string): number | null {
  const trimmed = raw.trim();
  // Un precio negativo no es un precio: no se puede vender en negativo.
  if (/^[-−–—]/.test(trimmed)) return null;

  const s = trimmed.replace(/[^\d.,]/g, "");
  if (!s || !/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    // Formato AR: 1.200,50 → puntos de miles, coma decimal
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // 1,200.50 (US) o 1.200 (miles AR)
    if (s.indexOf(",") > -1 && lastComma > 0) {
      normalized = s.replace(/,/g, ""); // US: coma de miles
    } else if (s.split(".").length > 2) {
      normalized = s.replace(/\./g, ""); // 1.234.567 → miles
    } else {
      const decimals = s.length - lastDot - 1;
      normalized = decimals === 3 ? s.replace(/\./g, "") : s; // 1.200 → miles
    }
  } else {
    normalized = s; // solo dígitos
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Precio al final de la línea.
 *
 * Exige que después del número no haya letras, para que "Agua mineral 500ml"
 * NO se lea como un precio de 500.
 */
const TRAILING_PRICE = /(?:^|[\s\-–—:•|]|a|x|X|=)\s*\$?\s*(?:ARS|USD)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:ARS|USD|pesos)?\s*$/;

/** Marcadores de lista: "- ", "* ", "• ", "1. ", "1) ", "1 -" */
const LIST_MARKER = /^\s*(?:[-–—*•·▪]|[\d]{1,2}\s*[.)]|[\d]{1,2}\s*[-–—])\s+/;

export function parsePriceList(text: string, defaultCategory: string | null = null): ParseResult {
  const products: ParsedProduct[] = [];
  const rejected: RejectedLine[] = [];
  const lines = (text || "").split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = i + 1;
    let working = raw.trim();

    if (!working) continue;
    // Separadores (incluye los de cajita: ─ ━ ┄) y encabezados típicos
    if (/^[-=_*~.\s─-╿═]{3,}$/.test(working)) continue;
    if (
      /^(producto|item|art[ií]culo|descripci[oó]n|precio|total|nombre|c[oó]digo)\s*[:—-]?\s*$/i.test(working) ||
      /^(producto|item|art[ií]culo)\s+(precio|total)\s*$/i.test(working)
    ) {
      continue;
    }

    working = working.replace(LIST_MARKER, "").trim();

    // ¿Trae categoría? "Alfajor | Dulces | 1200" o "Alfajor (Dulces) - 1200"
    let category = defaultCategory;
    const pipeParts = working.split("|").map((p) => p.trim()).filter(Boolean);
    if (pipeParts.length >= 3) {
      category = pipeParts[1] || category;
      working = `${pipeParts[0]} - ${pipeParts[pipeParts.length - 1]}`;
    } else {
      // "Alfajor (Dulces) - 1200" → categoría "Dulces", se conserva el precio.
      const paren = working.match(/^(.+?)\s*[\(\[]\s*([^)\]]{2,40})\s*[\)\]]\s*(.*)$/);
      if (paren) {
        category = paren[2].trim() || category;
        // IMPORTANTE: hay que re-enganchar el resto de la línea (el precio),
        // si no el producto se rechaza por "sin precio".
        const rest = paren[3].trim();
        working = rest ? `${paren[1].trim()} ${rest}` : paren[1].trim();
      }
    }

    const m = working.match(TRAILING_PRICE);
    if (!m) {
      rejected.push({
        raw: raw.trim(),
        line,
        reason: "No encontré un precio al final de la línea",
      });
      continue;
    }

    const priceCents = parsePriceToCents(m[1]);
    if (priceCents === null) {
      rejected.push({ raw: raw.trim(), line, reason: "El precio no es un número válido" });
      continue;
    }
    if (priceCents === 0) {
      rejected.push({ raw: raw.trim(), line, reason: "El precio es $0" });
      continue;
    }

    // El nombre es lo que queda antes del precio.
    let label = working.slice(0, m.index).trim();
    label = label.replace(/[\s\-–—:|]+$/, "").trim();
    label = label.replace(/^[\s\-–—:|]+/, "").trim();
    // Un nombre con 2+ palabras es creíble; "1200" solo no lo es.
    if (!label || label.length < 2) {
      rejected.push({ raw: raw.trim(), line, reason: "La línea no tiene nombre de producto" });
      continue;
    }
    if (label.length > 120) label = label.slice(0, 120);

    products.push({ label, priceCents, category, raw: raw.trim(), line });
  }

  return { products, rejected };
}

/** Formatea centavos a pesos legibles: 120000 → "$1.200", 120050 → "$1.200,50". */
export function formatCents(cents: number): string {
  const pesos = cents / 100;
  // `minimumFractionDigits: 2` a secas mostraría "$1.200,00" para un precio
  // redondo. Solo mostrarlos si el monto los tiene.
  const hasDecimals = Math.abs(pesos % 1) > 0.0001;
  return `$${pesos.toLocaleString("es-AR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Texto de ejemplo que se muestra en el form como ayuda. */
export const PRICE_LIST_EXAMPLE = `Alfajor de chocolate - 1200
Café con leche $1.200,50
* Empanada de carne: $3500
- Agua mineral 500ml 800
1. Bolo de queso —— 2.500

También acepta categorías:
Café con leche | Bebidas | 2500`;
