import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function getAuthUser() {
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sessionClient = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });
  const { data: { user } } = await sessionClient.auth.getUser();
  return user;
}

// GET: List assignments for an instance
export async function GET(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  if (!instanceId) return NextResponse.json({ status: "error", error: "instanceId required" }, { status: 400 });

  const { data: instance } = await supabase.from("instances").select("id").eq("id", instanceId).eq("admin_id", user.id).single();
  if (!instance) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const { data: assignments, error } = await supabase
    .from("user_instances").select("id, user_id, assigned_at, profiles:user_id(id, email, full_name)")
    .eq("instance_id", instanceId);

  if (error) return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: assignments });
}

// POST: Assign user to instance
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

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

  // Validar limite de bots del plan: base (1) + add-ons activos
  const { data: effectiveMax, error: maxError } = await supabase
    .rpc("get_effective_max_instances", { p_user_id: targetUser.id });
  if (maxError) return NextResponse.json({ status: "error", error: maxError.message }, { status: 500 });

  const { count: currentCount } = await supabase
    .from("user_instances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetUser.id);

  const max = Number(effectiveMax ?? 1);
  const current = Number(currentCount ?? 0);
  if (current >= max) {
    return NextResponse.json(
      { status: "error", error: `El usuario alcanzo su limite de ${max} bots. Contrata add-ons para ampliarlo.` },
      { status: 409 }
    );
  }

  const { data: assignment, error } = await supabase.from("user_instances").insert({ user_id: targetUser.id, instance_id: instanceId }).select().single();
  if (error) return NextResponse.json({ status: "error", error: error.message }, { status: 500 });

  return NextResponse.json({ status: "success", data: assignment });
}

// DELETE: Unassign
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "admin", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const user = await getAuthUser();
  if (!user) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });

  const supabase = await createServerClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("id");
  if (!assignmentId) return NextResponse.json({ status: "error", error: "id required" }, { status: 400 });

  const { data: assignment } = await supabase.from("user_instances").select("id, instance_id").eq("id", assignmentId).single();
  if (!assignment) return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });

  const { data: inst } = await supabase.from("instances").select("id").eq("id", assignment.instance_id).eq("admin_id", user.id).single();
  if (!inst) return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });

  const { error } = await supabase.from("user_instances").delete().eq("id", assignmentId);
  if (error) return NextResponse.json({ status: "error", error: error.message }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
