import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";

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

  const [{ rows: instances }] = await query<{ id: string; instance_name: string; status: string; evolution_api_url: string }>(
    "SELECT id, instance_name, status, evolution_api_url FROM instances WHERE admin_id = ? ORDER BY created_at DESC",
    [auth.user.id]
  );

  if (!instances || instances.length === 0) {
    return NextResponse.json({ status: "success", data: [] });
  }

  const instanceIds = instances.map((i) => i.id);

  const [{ rows: assignments }] = await query<{ instance_id: string; user_id: string }>(
    "SELECT instance_id, user_id FROM user_instances WHERE instance_id IN (" + instanceIds.map(() => "?").join(", ") + ")",
    instanceIds
  );

  const userIds = [...new Set(assignments.map((a) => a.user_id))];

  const usersById = new Map();
  if (userIds.length > 0) {
    const [{ rows: profiles }] = await query<{ id: string; email: string; full_name: string }>(
      "SELECT id, email, full_name FROM profiles WHERE id IN (" + userIds.map(() => "?").join(", ") + ")",
      userIds
    );
    for (const p of profiles) {
      usersById.set(p.id, p);
    }
  }

  const servers = new Map();
  for (const inst of instances) {
    const assigned = (assignments || []).filter((a) => a.instance_id === inst.id);
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
