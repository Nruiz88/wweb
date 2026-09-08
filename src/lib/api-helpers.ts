/**
 * Shared API helpers for safe error responses and instance access checks.
 */

/** Log error server-side and return safe generic message */
export function safeErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  if (err) {
    console.error("[api-error]", { code: err.code, message: err.message });
    // Si es tabla/columna faltante (migración no aplicada), informar claramente
    if (err.code === "42P01") return "Tabla no encontrada — la migración de DB aún no se aplicó (ejecutá `supabase db push`)";
    if (err.code === "42703") return "Columna no encontrada — verificación de esquema necesaria";
    // Para errores de restricción/permisos, algo concreto
    if (err.message?.includes("violates") || err.message?.includes("constraint")) return "Datos inválidos — revisá los campos";
  }
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

  // Assigned user via user_instances (only if subscription is active; pending users blocked)
  const { data: assignment } = await supabase
    .from("user_instances")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .single();
  if (assignment) {
    const { data: sub } = await supabase.from("subscriptions").select("status").eq("user_id", userId).single();
    if (sub && sub.status === "pending") return false;
    return true;
  }
  return false;
}
