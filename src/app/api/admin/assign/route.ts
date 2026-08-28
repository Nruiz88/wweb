import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List assignments for an instance
export async function GET(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  const { data: instance } = await supabase.from("instances").select("id").eq("id", instanceId).eq("admin_id", user.id).single();
  if (!instance) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const { data: assignments, error } = await supabase
    .from("user_instances").select("id, user_id, assigned_at, profiles:user_id(id, email, full_name)")
    .eq("instance_id", instanceId);

  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  return NextResponse.json({ status: "success", data: assignments });
}

// POST: Assign user to instance
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceId, userEmail } = (body ?? {}) as { instanceId?: string; userEmail?: string };
  if (!instanceId || !userEmail) return NextResponse.json({ status: "error", error: "instanceId and userEmail required" }, { status: 400 });

  const { data: instance } = await supabase.from("instances").select("id").eq("id", instanceId).eq("admin_id", user.id).single();
  if (!instance) return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });

  const { data: targetUser, error: userError } = await supabase.from("profiles").select("id").eq("email", userEmail).single();
  if (userError || !targetUser) return NextResponse.json({ status: "error", error: "User not found with that email" }, { status: 404 });

  const { data: existing } = await supabase.from("user_instances").select("id").eq("user_id", targetUser.id).eq("instance_id", instanceId).single();
  if (existing) return NextResponse.json({ status: "error", error: "User already assigned" }, { status: 409 });

  const { data: effectiveMax, error: maxError } = await supabase.rpc("get_effective_max_instances", { p_user_id: targetUser.id });
  if (maxError) return NextResponse.json({ status: "error", error: safeErrorMessage(maxError) }, { status: 500 });

  const { count: currentCount } = await supabase.from("user_instances").select("id", { count: "exact", head: true }).eq("user_id", targetUser.id);

  const max = Number(effectiveMax ?? 1);
  const current = Number(currentCount ?? 0);
  if (current >= max) {
    return NextResponse.json(
      { status: "error", error: `El usuario alcanzo su limite de ${max} bots. Contrata add-ons para ampliarlo.` },
      { status: 409 }
    );
  }

  const { data: assignment, error } = await supabase.from("user_instances").insert({ user_id: targetUser.id, instance_id: instanceId }).select().single();
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });

  return NextResponse.json({ status: "success", data: assignment });
}

// DELETE: Unassign
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("id");
  if (!assignmentId) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });

  const { data: assignment } = await supabase.from("user_instances").select("id, instance_id").eq("id", assignmentId).single();
  if (!assignment) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const { data: inst } = await supabase.from("instances").select("id").eq("id", assignment.instance_id).eq("admin_id", user.id).single();
  if (!inst) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });

  const { error } = await supabase.from("user_instances").delete().eq("id", assignmentId);
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
