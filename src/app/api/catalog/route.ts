import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { verifyUserAccess, safeErrorMessage } from "@/lib/api-helpers";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/catalog?instanceId=xxx
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const instanceId = url.searchParams.get("instanceId");
  if (!instanceId || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  const items = await query<{ id: string; instance_id: string; label: string; description: string | null; price_cents: number; active: boolean; sort_order: number; category: string | null; created_at: string; updated_at: string }>(
    "SELECT id, instance_id, label, description, price_cents, active, sort_order, category, created_at, updated_at FROM catalog_items WHERE instance_id = ? ORDER BY sort_order ASC",
    [instanceId]
  );

  return NextResponse.json({ status: "success", data: items });
}

// POST /api/catalog { instanceId, label, price_cents, description, category, active, sort_order }
export async function POST(request: Request) {
  const rl = await rateLimitResponse(request, "catalog-post", { maxRequests: 30 });
  if (rl) return rl;

  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, label, price_cents, description, category, active, sort_order } = body as {
    instanceId?: unknown; label?: unknown; price_cents?: unknown; description?: unknown;
    category?: unknown; active?: unknown; sort_order?: unknown;
  };

  if (typeof instanceId !== "string" || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });
  const cleanLabel = String(label ?? "").trim();
  if (!cleanLabel) return NextResponse.json({ status: "error", error: "label required" }, { status: 400 });
  const price = Number(price_cents);
  if (isNaN(price) || price < 0) return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 });

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  const id = Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
  const { insertId } = await query(
    "INSERT INTO catalog_items (id, instance_id, label, description, price_cents, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
    [id, instanceId, cleanLabel, description ? String(description).trim() : null, Math.round(price), active ?? true, Number(sort_order) || 0]
  );

  return NextResponse.json({ status: "success", data: { id: insertId, label: cleanLabel, price_cents: Math.round(price) } });
}

// PATCH /api/catalog { id, ...fields }
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { id, label, price_cents, description, category, active, sort_order } = body as {
    id?: unknown; label?: unknown; price_cents?: unknown; description?: unknown;
    category?: unknown; active?: unknown; sort_order?: unknown;
  };

  if (typeof id !== "string" || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });

  const existing = await query<{ instance_id: string }>(
    "SELECT instance_id FROM catalog_items WHERE id = ? LIMIT 1",
    [id]
  );

  if (!existing.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  const updates: Record<string, any> = {};
  if (label !== undefined) { const c = String(label).trim(); if (!c) return NextResponse.json({ status: "error", error: "label invalid" }, { status: 400 }); updates.label = c; }
  if (price_cents !== undefined) { const p = Number(price_cents); if (isNaN(p) || p < 0) return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 }); updates.price_cents = Math.round(p); }
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (category !== undefined) updates.category = category ? String(category).trim() : null;
  if (active !== undefined) updates.active = !!active;
  if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;

  if (Object.keys(updates).length === 0) return NextResponse.json({ status: "success" });

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`);
  const values = [...Object.values(updates), id];
  await query(`UPDATE catalog_items SET ${setClauses.join(", ")} WHERE id = ?`, values);

  return NextResponse.json({ status: "success", data: { id, ...updates } });
}

// DELETE /api/catalog?id=xxx
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });

  const existing = await query<{ instance_id: string }>(
    "SELECT instance_id FROM catalog_items WHERE id = ? LIMIT 1",
    [id]
  );

  if (!existing.length) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  await query("DELETE FROM catalog_items WHERE id = ?", [id]);
  return NextResponse.json({ status: "success" });
}
