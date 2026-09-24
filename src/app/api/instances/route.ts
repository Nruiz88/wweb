import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { query, select } from "../../../lib/db";
import { getConnectionState, testEvolutionConnection } from "../../../lib/evolution-multi";
import { validateEvolutionUrl, sanitizeString } from "../../../lib/validation";
import { safeErrorMessage } from "../../../lib/api-helpers";

export const dynamic = "force-dynamic";

interface InstanceRow {
  id: string;
  instance_name: string;
  status: string;
  created_at: string;
  evolution_api_url?: string;
  evolution_api_key?: string;
  status_checked_at?: string | null;
}

type ServiceClient = any;

function sanitizeInstance(instance: InstanceRow) {
  return {
    id: instance.id,
    instance_name: instance.instance_name,
    status: instance.status,
    created_at: instance.created_at,
  };
}

const statusCache = new Map<string, { status: string; at: number }>();
const STATUS_TTL_MS = 60_000;
const BASE_COLUMNS = "id, instance_name, status, created_at, evolution_api_url, evolution_api_key";

async function selectInstances(adminId: string | undefined, ids: string[] | undefined): Promise<{ rows: InstanceRow[]; freshCheck: boolean; error: unknown }> {
  let q: string;
  if (adminId !== undefined) {
    q = `SELECT ${BASE_COLUMNS}, status_checked_at FROM instances WHERE admin_id = ? ORDER BY created_at DESC`;
    const [{ rows }] = await query<InstanceRow>(q, [adminId]);
    return { rows: rows || [], freshCheck: true, error: null };
  }
  if (ids?.length) {
    const placeholders = ids.map(() => "?").join(",");
    q = `SELECT ${BASE_COLUMNS}, status_checked_at FROM instances WHERE id IN (${placeholders}) ORDER BY created_at DESC`;
    const [{ rows }] = await query<InstanceRow>(q, [...ids]);
    return { rows: rows || [], freshCheck: true, error: null };
  }
  return { rows: [], freshCheck: false, error: null };
}

async function persistStatus(id: string, status: string) {
  try {
    await query("UPDATE instances SET status = ?, status_checked_at = NOW() WHERE id = ?", [status, id]);
  } catch {
    // Non-critical
  }
}

async function withLiveStatus(instances: InstanceRow[], freshCheck: boolean) {
  const now = Date.now();
  const results = await Promise.all(instances.map(async (instance) => {
    if (!instance.evolution_api_url || !instance.evolution_api_key) {
      return sanitizeInstance(instance);
    }
    if (freshCheck && instance.status_checked_at) {
      const checkedAt = new Date(instance.status_checked_at).getTime();
      if (!Number.isNaN(checkedAt) && now - checkedAt < STATUS_TTL_MS) {
        return sanitizeInstance(instance);
      }
    }
    const cacheKey = `${instance.evolution_api_url}|${instance.instance_name}`;
    const cached = statusCache.get(cacheKey);
    if (cached && now - cached.at < STATUS_TTL_MS) {
      return sanitizeInstance({ ...instance, status: cached.status });
    }
    const state = await getConnectionState(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
    if (state.ok && state.data) {
      statusCache.set(cacheKey, { status: state.data, at: Date.now() });
      await persistStatus(instance.id, state.data);
      return sanitizeInstance({ ...instance, status: state.data });
    }
    return sanitizeInstance(instance);
  }));
  return results;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }
  const lite = new URL(request.url).searchParams.get("lite") === "1";

  const { rows: instances, freshCheck, error } = await selectInstances(session.userId, undefined);
  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }
  if (lite) {
    return NextResponse.json({ status: "success", data: instances.map(sanitizeInstance), role: "admin" });
  }
  const live = await withLiveStatus(instances, freshCheck);
  return NextResponse.json({ status: "success", data: live, role: "admin" });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { instanceName, evolutionApiUrl, evolutionApiKey } = body as { instanceName?: string; evolutionApiUrl?: string; evolutionApiKey?: string };

  const cleanName = sanitizeString(instanceName, 50);
  if (!cleanName) {
    return NextResponse.json({ status: "error", error: "Instance name is required" }, { status: 400 });
  }
  if (!evolutionApiUrl || !evolutionApiKey) {
    return NextResponse.json({ status: "error", error: "All fields are required" }, { status: 400 });
  }

  const urlCheck = validateEvolutionUrl(evolutionApiUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ status: "error", error: urlCheck.error }, { status: 400 });
  }

  const normalizedUrl = urlCheck.normalized || evolutionApiUrl.trim();
  const serverCheck = await testEvolutionConnection(normalizedUrl, evolutionApiKey);
  if (!serverCheck.ok) {
    const hint = serverCheck.status === 401 || serverCheck.status === 403 ? " (API key global de Evolution inválida)" : serverCheck.status === 404 ? " (URL mal)" : "";
    return NextResponse.json({ status: "error", error: `Servidor no responde: ${serverCheck.message}${hint}` }, { status: 400 });
  }

  const [{ insertId }] = await query(
    "INSERT INTO instances (id, admin_id, instance_name, evolution_api_url, evolution_api_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'connecting', NOW(), NOW())",
    [String(Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15), 15), session.userId, cleanName, normalizedUrl, evolutionApiKey]
  );

  return NextResponse.json({
    status: "success",
    data: { id: insertId, instance_name: cleanName, status: "connecting", created_at: new Date().toISOString() },
    message: "Servidor verificado — instancia lista. El usuario debe vincular QR en Mi WhatsApp para pasar a conectada.",
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const [{ rows: inst }] = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? LIMIT 1",
    [id]
  );
  if (!inst.length || inst[0].admin_id !== session.userId) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  await query("DELETE FROM instances WHERE id = ?", [id]);
  return NextResponse.json({ status: "success" });
}
