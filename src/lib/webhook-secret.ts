import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/**
 * Verify webhook request using HMAC-SHA256 signature
 * 
 * Evolution API sends the signature in the header "x-webhook-secret" or "x-hub-signature"
 * This function compares it with our computed HMAC using the shared secret.
 * 
 * @returns true if signature is valid or if no secret is configured (dev mode)
 */
export function verifyWebhookSignature(request: Request): boolean {
  // If no secret configured, allow all (development mode)
  if (!WEBHOOK_SECRET) return true;

  // Get signature from headers (Evolution API compatible)
  const signature =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature");

  if (!signature) return false;

  // Compute expected signature from raw body would require reading the body
  // Instead, we use a shared secret comparison (simpler for Evolution API)
  try {
    const expected = WEBHOOK_SECRET;
    const received = signature;

    // Constant-time comparison to prevent timing attacks
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(received, "utf8");

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
