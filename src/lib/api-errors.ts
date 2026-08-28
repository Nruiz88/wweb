/**
 * Sanitize error messages before sending to clients.
 * Never expose raw database errors, SQL state, or internal details.
 */

/** Map of known error messages to safe client-facing messages */
const SAFE_MESSAGES: Record<string, string> = {
  "23505": "A record with this data already exists",
  "23503": "This record is referenced by other data",
  "23502": "Required field is missing",
  "42501": "Permission denied",
  "PGRST116": "Record not found",
};

/**
 * Convert a raw database error to a safe client-facing message.
 * Logs the real error server-side, returns a generic message to the client.
 */
export function sanitizeDbError(error: { code?: string; message?: string; hint?: string } | null): string {
  if (!error) return "An unexpected error occurred";

  // Log the real error server-side
  console.error("[db-error]", {
    code: error.code,
    message: error.message,
    hint: error.hint,
  });

  // Return safe message
  if (error.code && SAFE_MESSAGES[error.code]) {
    return SAFE_MESSAGES[error.code];
  }

  // Check for common patterns
  if (error.message?.includes("permission denied")) {
    return "Permission denied";
  }
  if (error.message?.includes("does not exist")) {
    return "Resource not found";
  }
  if (error.message?.includes("duplicate key")) {
    return "A record with this data already exists";
  }

  return "An unexpected error occurred";
}
