/**
 * Shared API helpers for safe error responses.
 * Usage: import { apiError } from "@/lib/api-helpers";
 */

/** Log error server-side and return safe generic message */
export function safeErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;

  // Log the real error server-side
  if (err) {
    console.error("[api-error]", { code: err.code, message: err.message });
  }

  // Never expose raw DB errors to clients
  return "An unexpected error occurred";
}

/** Create a standardized error JSON response */
export function apiError(message: string, status = 500) {
  return Response.json({ status: "error", error: message }, { status });
}
