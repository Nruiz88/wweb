import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query, generateId } from "@/lib/db";
import { isValidId } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, quantity } = body as { userId?: string; quantity?: number };
  if (!userId || !isValidId(userId) || quantity == null || !Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ status: "error", error: "userId y quantity requeridos" }, { status: 400 });
  }

  // `instance_addons` solo tiene UNIQUE en la PK `id`, así que el
  // `ON DUPLICATE KEY UPDATE` original NUNCA disparaba (el id era aleatorio
  // nuevo en cada llamada) → cada PATCH insertaba una fila y
  // `checkInstanceLimit` hacía SUM(quantity) sobre todas: el límite de
  // instancias se inflaba sin control con cada guardado del admin.
  // Además `quantity` tiene CHECK (quantity > 0), así que mandar 0 daba 3819.
  //
  // Sin migración: se cancelan los add-ons activos del usuario y se inserta
  // uno nuevo con la cantidad pedida. `quantity === 0` =_quitar todos.
  await query(
    "UPDATE instance_addons SET status = 'canceled', updated_at = NOW() WHERE user_id = ? AND status = 'active'",
    [userId]
  );

  if (quantity > 0) {
    await query(
      `INSERT INTO instance_addons (id, user_id, quantity, status, created_at, updated_at)
       VALUES (?, ?, ?, 'active', NOW(), NOW())`,
      [generateId(), userId, Math.floor(quantity)]
    );
  }

  return NextResponse.json({ status: "success" });
}
