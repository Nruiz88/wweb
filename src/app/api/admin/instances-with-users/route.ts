import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_USERS_PER_INSTANCE = 10;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  const { data: instances } = await supabase
    .from("instances")
    .select("id, instance_name, status")
    .eq("admin_id", user.id)
    .order("created_at", { ascending: false });

  if (!instances || instances.length === 0) {
    return NextResponse.json({ status: "success", data: [] });
  }

  const instanceIds = instances.map((i) => i.id);

  const { data: assignments } = await supabase
    .from("user_instances")
    .select("instance_id, user_id")
    .in("instance_id", instanceIds);

  const userIds = [
    ...new Set((assignments ?? []).map((a) => a.user_id)),
  ];

  const usersById = new Map<string, { id: string; email: string; full_name: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    for (const p of profiles ?? []) {
      usersById.set(p.id, p);
    }
  }

  const data = instances.map((inst) => {
    const assigned = (assignments ?? []).filter((a) => a.instance_id === inst.id);
    const users = assigned
      .map((a) => usersById.get(a.user_id))
      .filter((u): u is { id: string; email: string; full_name: string | null } => Boolean(u))
      .map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }));

    return {
      id: inst.id,
      instance_name: inst.instance_name,
      status: inst.status,
      user_count: assigned.length,
      max_users: MAX_USERS_PER_INSTANCE,
      remaining: Math.max(0, MAX_USERS_PER_INSTANCE - assigned.length),
      users,
    };
  });

  return NextResponse.json({ status: "success", data });
}