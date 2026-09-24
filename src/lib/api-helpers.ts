/**
 * Shared API helpers for safe error responses and instance access checks.
 */

/** Log error server-side and return safe generic message */
export function safeErrorMessage(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;
  if (err) {
    console.error("[api-error]", { code: err.code, message: err.message });
    if (err.code === "42P01") return "Tabla no encontrada — la migración de DB aún no se aplicó";
    if (err.code === "42703") return "Columna no encontrada — verificación de esquema necesaria";
    if (err.message?.includes("violates") || err.message?.includes("constraint")) {
      return "Datos inválidos — revisá los campos";
    }
  }
  return "Ocurrió un error inesperado";
}

/** Verify a user has access to an instance (owner or assigned via user_instances).
 * Uses MariaDB queries directly (no Supabase).
 */
export async function verifyUserAccess(userId: string, instanceId: string): Promise<boolean> {
  const { db } = await import("./db");
  // Owner: admin of the instance
  const [instRows] = await db.query(
    "SELECT 1 FROM instances WHERE id = ? AND admin_id = ? LIMIT 1",
    [instanceId, userId]
  );
  if (instRows.length > 0) return true;

  // Assigned user via user_instances
  const [assignmentRows] = await db.query(
    "SELECT 1 FROM user_instances WHERE instance_id = ? AND user_id = ? LIMIT 1",
    [instanceId, userId]
  );
  if (assignmentRows.length > 0) return true;

  return false;
}
