import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess, safeErrorMessage } from "@/lib/api-helpers";
import { isValidUUID, sanitizeString } from "@/lib/validation";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/catalog?instanceId=xxx
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  const url = new URL(request.url);
  const instanceId = url.searchParams.get("instanceId");
  if (!instanceId || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });
  const access = await verifyUserAccess(supabase, user.id, instanceId);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("catalog_items").select("*").eq("instance_id", instanceId).order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

// POST /api/catalog { instanceId, label, price_cents, description, category, active, sort_order }
export async function POST(request: Request) {
  const rl = await rateLimitResponse(request, "catalog-post", { maxRequests: 30 });
  if (rl) return rl;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { instanceId, label, price_cents, description, category, active, sort_order } = body as {
    instanceId?: unknown; label?: unknown; price_cents?: unknown; description?: unknown;
    category?: unknown; active?: unknown; sort_order?: unknown;
  };
  if (typeof instanceId !== "string" || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });
  const cleanLabel = sanitizeString(label, 80);
  if (!cleanLabel) return NextResponse.json({ status: "error", error: "label required" }, { status: 400 });
  const price = Number(price_cents);
  if (isNaN(price) || price < 0) return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 });
  const access = await verifyUserAccess(supabase, user.id, instanceId);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const { data, error } = await supabase.from("catalog_items").insert({
    instance_id: instanceId,
    label: cleanLabel,
    description: sanitizeString(description, 200) || null,
    price_cents: Math.round(price),
    category: sanitizeString(category, 40) || null,
    active: active ?? true,
    sort_order: Number(sort_order) || 0,
  }).select("*").single();
  if (error) {
    console.error("[catalog POST] error:", JSON.stringify(error));
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }
  return NextResponse.json({ status: "success", data });
}

// PATCH /api/catalog { id, ...fields }
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { id, label, price_cents, description, category, active, sort_order } = body as {
    id?: unknown; label?: unknown; price_cents?: unknown; description?: unknown;
    category?: unknown; active?: unknown; sort_order?: unknown;
  };
  if (typeof id !== "string" || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  const { data: existing } = await supabase.from("catalog_items").select("instance_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  const access = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const updates: { label?: string; price_cents?: number; description?: string | null; category?: string | null; active?: boolean; sort_order?: number; updated_at?: string } = {};
  if (label !== undefined) { const c = sanitizeString(label, 80); if (!c) return NextResponse.json({ status: "error", error: "label invalid" }, { status: 400 }); updates.label = c; }
  if (price_cents !== undefined) { const p = Number(price_cents); if (isNaN(p) || p < 0) return NextResponse.json({ status: "error", error: "price invalid" }, { status: 400 }); updates.price_cents = Math.round(p); }
  if (description !== undefined) updates.description = sanitizeString(description, 200);
  if (category !== undefined) updates.category = sanitizeString(category, 40);
  if (active !== undefined) updates.active = !!active;
  if (sort_order !== undefined) updates.sort_order = Number(sort_order) || 0;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("catalog_items").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

// DELETE /api/catalog?id=xxx
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  const { data: existing } = await supabase.from("catalog_items").select("instance_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  const access = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const { error } = await supabase.from("catalog_items").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
