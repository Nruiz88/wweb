import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * Verify webhook request using HMAC-SHA256 signature
 *
 * Evolution API se configura con el header "x-webhook-secret".
 * Soporta dos formatos:
 *   - Header en claro igual al secret (compatibilidad)
 *   - Firma HMAC-SHA256 del body: "sha256=<hex>" (x-hub-signature-256)
 *
 * @returns true if signature is valid or if no secret is configured (dev mode)
 */
export async function verifyWebhookSignature(
  request: Request,
  rawBody?: string
): Promise<boolean> {
  // If no secret configured, allow all (development mode)
  if (!WEBHOOK_SECRET) return true;

  const signature =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature");

  if (!signature) return false;

  // HMAC mode: sha256=<hexdigest> del raw body
  if (signature.startsWith("sha256=")) {
    const body = rawBody ?? (await request.text());
    const expected = createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");
    const received = signature.slice("sha256=".length);

    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(received, "utf8");

    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  }

  // Plain mode: header en claro igual al secret
  try {
    const expectedBuf = Buffer.from(WEBHOOK_SECRET, "utf8");
    const receivedBuf = Buffer.from(signature, "utf8");

    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

/**
 * Sign a payload with HMAC-SHA256 (for testing or outgoing webhooks)
 */
export function signPayload(payload: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
}

/**
 * Get the configured webhook secret (for setup instructions)
 */
export function getWebhookSecret(): string {
  return WEBHOOK_SECRET;
}
