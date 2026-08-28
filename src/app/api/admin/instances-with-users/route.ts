import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

const MAX_INSTANCES_PER_SERVER = 10;

interface InstanceInfo {
  id: string;
  instance_name: string;
  status: string;
  user_count: number;
  users: { id: string; email: string; full_name: string | null }[];
}

interface ServerCapacity {
  server_url: string;
  instance_count: number;
  max_instances: number;
  remaining: number;
  instances: InstanceInfo[];
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  const { data: instances } = await supabase
    .from("instances")
    .select("id, instance_name, status, evolution_api_url")
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

  const userIds = [...new Set((assignments ?? []).map((a) => a.user_id))];

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

  const servers = new Map<string, ServerCapacity>();

  for (const inst of instances) {
    const assigned = (assignments ?? []).filter((a) => a.instance_id === inst.id);
    const users = assigned
      .map((a) => usersById.get(a.user_id))
      .filter((u): u is { id: string; email: string; full_name: string | null } => Boolean(u))
      .map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }));

    const instanceInfo: InstanceInfo = {
      id: inst.id,
      instance_name: inst.instance_name,
      status: inst.status,
      user_count: assigned.length,
      users,
    };

    const serverUrl = inst.evolution_api_url || "sin-servidor";

    if (!servers.has(serverUrl)) {
      servers.set(serverUrl, {
        server_url: serverUrl,
        instance_count: 0,
        max_instances: MAX_INSTANCES_PER_SERVER,
        remaining: MAX_INSTANCES_PER_SERVER,
        instances: [],
      });
    }

    const server = servers.get(serverUrl)!;
    server.instances.push(instanceInfo);
    server.instance_count = server.instances.length;
    server.remaining = Math.max(0, MAX_INSTANCES_PER_SERVER - server.instances.length);
  }

  const data = [...servers.values()].sort((a, b) => b.instance_count - a.instance_count);

  return NextResponse.json({ status: "success", data });
}
