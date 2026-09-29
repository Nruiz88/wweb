/**
 * URL validation for Evolution API endpoints.
 * Prevents SSRF by blocking private/internal IPs and non-HTTP schemes.
 */

// Blocked IP ranges (RFC 1918, loopback, link-local, cloud metadata)
const BLOCKED_PATTERNS = [
  /^https?:\/\/(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/,
  /^https?:\/\/localhost/i,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/metadata\.google\.internal/i,
  /^https?:\/\/169\.254\.169\.254/i,
];

// Allowed schemes
const ALLOWED_SCHEMES = ["http:", "https:"];

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  /** Normalized URL (fixed double-scheme, trailing slash stripped). */
  normalized?: string;
}

/**
 * Normalize a user-entered base URL: remove a duplicated scheme
 * (e.g. "https://https://..." or "https://https//...") and a trailing slash.
 */
export function normalizeBaseUrl(raw: string): string {
  let url = (raw || "").trim();
  if (!url) return "";

  // Fix doubled schemes: "https://https://x" / "https://http://x" / "https://https//x"
  url = url.replace(/^(https?:\/\/)\1/, "$1");
  url = url.replace(/^https?:\/\/https?\/\//, "https://");
  // Collapse "https://https" into "https://"
  url = url.replace(/^(https?:\/\/)https?$/, "$1");

  // Remove trailing slash
  url = url.replace(/\/+$/, "");
  return url;
}

/**
 * Validate an Evolution API URL.
 * Checks: valid URL format, allowed scheme, no private/internal IPs.
 */
export function validateEvolutionUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  // Trim whitespace
  const normalized = normalizeBaseUrl(url);
  if (!normalized) {
    return { valid: false, error: "URL is required" };
  }

  // Check it's a valid URL
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS are allowed" };
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return { valid: false, error: "This URL is not allowed (private or internal address)" };
    }
  }

  // Block common metadata endpoints
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "169.254.169.254" ||
    hostname === "metadata.google.internal" ||
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    hostname === "https"
  ) {
    return { valid: false, error: "Invalid URL host" };
  }

  return { valid: true, normalized };
}

/**
 * Validate a UUID format string (any version).
 * Used to prevent injection of crafted IDs in query parameters.
 */
export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Valida un id de recurso de la app.
 *
 * La app genera ids con `generateId()` (uuidv4) desde la migración a MariaDB,
 * pero muchas filas existentes se crearon antes con
 * `Math.random().toString(36)` × 2 → 30 chars de base36, NO UUID.
 *
 * `isValidUUID` solo aceptaba UUID, así que /api/catalog y /api/orders
 * devolvían 400 para cualquier instancia creada por la propia API
 * (Catálogo y Pedidos dead), y los botones de recordatorio de los turnos
 * creados por la API no funcionaban nunca.
 *
 * Ambos formatos son seguros contra inyección: se sigue exigiendo un charset
 * acotado, sin comillas ni espacios.
 */
export function isValidId(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  if (isValidUUID(value)) return true;
  // Legacy: 30 chars base36 ([0-9a-z]) generado por la app.
  return /^[0-9a-z]{20,64}$/.test(value);
}

/**
 * Sanitize a string input — trim, enforce max length.
 */
export function sanitizeString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Validate a phone number format (digits + optional + prefix).
 */
export function isValidPhone(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^\+?[0-9]{7,15}$/.test(value.trim());
}
