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
  const trimmed = url.trim();

  // Check it's a valid URL
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: "Only HTTP and HTTPS are allowed" };
  }

  // Check against blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
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
    hostname === "[::1]"
  ) {
    return { valid: false, error: "This URL is not allowed" };
  }

  return { valid: true };
}

/**
 * Validate a UUID v4 format string.
 * Used to prevent injection of crafted IDs in query parameters.
 */
export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
