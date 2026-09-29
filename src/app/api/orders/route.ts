import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, exec } from "@/lib/db";
import { toMySQLDateTime } from "@/lib/timezone";
import { isValidId } from "@/lib/validation";
import { verifyUserAccess } from "@/lib/api-helpers";
import { todayInBusinessTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

// GET /api/orders?instanceId=xxx&date=YYYY-MM-DD|today
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const date = searchParams.get("date");
  if (!instanceId || !isValidId(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  // Acceso: owner (instances.admin_id) UNION asignada (user_instances) — la
  // misma fuente de verdad que verifyUserAccess(), en vez de reimplementarla
  // (ya rompió una vez en /calendar).
  if (!(await verifyUserAccess(session.userId, instanceId))) {
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  const where: string[] = ["instance_id = ?"];
  const params: any[] = [instanceId];
  if (date) {
    // `today` se calculaba con toISOString() (UTC) contra un TIMESTAMP que se
    // escribe con NOW() (UTC del server): después de las 21:00 ART el filtro
    // mostraba el día equivocado. Se usa la zona del negocio.
    const d = date === "today" ? todayInBusinessTimezone() : date;
    where.push("created_at >= ?", "created_at <= ?");
    params.push(`${d} 00:00:00`, `${d} 23:59:59`);
  }

  // El ORDER BY iba antes de los AND → error de sintaxis en cuanto se filtraba
  // por fecha (y `SELECT *` arrastraba customer_* y notes sin necesidad).
  const orders = await query<any>(
    `SELECT id, instance_id, customer_phone, customer_name, catalog_item_id, option_label, price_cents, status, created_at
     FROM orders WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 100`,
    params
  );
  return NextResponse.json({ status: "success", data: orders });
}

// PATCH /api/orders { id, status }
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || !isValidId(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  if (typeof status !== "string" || !["pending", "completed", "canceled"].includes(status)) return NextResponse.json({ status: "error", error: "status invalid" }, { status: 400 });

  // Verify belongs to user
  const inst = await query<{ id: string }>(
    "SELECT id FROM orders WHERE id = ? AND instance_id IN (SELECT id FROM instances WHERE admin_id = ? UNION SELECT instance_id FROM user_instances WHERE user_id = ?)",
    [id, session.userId, session.userId]
  );
  if (!inst.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  // `query` devuelve filas; para un UPDATE hay que usar `exec`. Además
  // `insertId` en un UPDATE siempre es 0, y la respuesta mandaba eso como `id`
  // en vez del id real del pedido.
  const { affectedRows } = await exec(
    "UPDATE orders SET status = ?, completed_at = IF(? = 'completed', NOW(), completed_at) WHERE id = ?",
    [status, status, id]
  );
  if (affectedRows === 0) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: "success",
    data: { id, status, completed_at: status === "completed" ? toMySQLDateTime() : null },
  });
}
