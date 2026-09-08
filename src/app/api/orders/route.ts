import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess, safeErrorMessage } from "@/lib/api-helpers";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/orders?instanceId=xxx&date=YYYY-MM-DD|today
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  const url = new URL(request.url);
  const instanceId = url.searchParams.get("instanceId");
  const date = url.searchParams.get("date");
  if (!instanceId || !isValidUUID(instanceId)) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });
  const access = await verifyUserAccess(supabase, user.id, instanceId);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  let query = supabase.from("orders").select("*").eq("instance_id", instanceId).order("created_at", { ascending: false });
  if (date) {
    const d = date === "today" ? new Date().toISOString().slice(0, 10) : date;
    query = query.gte("created_at", `${d}T00:00:00`).lte("created_at", `${d}T23:59:59`);
  }
  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

// PATCH /api/orders { id, status }
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  const supabase = await createServerClient();
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }
  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || !isValidUUID(id)) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });
  if (typeof status !== "string" || !["pending","completed","canceled"].includes(status)) return NextResponse.json({ status: "error", error: "status invalid" }, { status: 400 });
  const { data: existing } = await supabase.from("orders").select("instance_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  const access = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!access) return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  const updates: { status: string; completed_at?: string } = { status };
  if (status === "completed") updates.completed_at = new Date().toISOString();
  const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
