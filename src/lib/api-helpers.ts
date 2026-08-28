/**
 * Shared API helpers for safe error responses and instance access checks.
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

/**
 * Verify a user has access to an instance (owner or assigned via user_instances).
 * Centralized to avoid IDOR across API routes.
 */
export async function verifyUserAccess(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerClient>>,
  userId: string,
  instanceId: string,
): Promise<boolean> {
  // Owner: admin of the instance
  const { data: adminInstance } = await supabase
    .from("instances")
    .select("id")
    .eq("id", instanceId)
    .eq("admin_id", userId)
    .single();
  if (adminInstance) return true;

  // Assigned user via user_instances
  const { data: assignment } = await supabase
    .from("user_instances")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .single();
  return !!assignment;
}
