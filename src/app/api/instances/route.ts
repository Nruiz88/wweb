import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, generateId } from "@/lib/db";
import { getConnectionState, testEvolutionConnection } from "@/lib/evolution-multi";
import { validateEvolutionUrl, sanitizeString } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/api-helpers";
import { checkInstanceLimit } from "@/lib/plan-gating";

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

/**
 * Instancias visibles para el usuario: las que ES dueño (instances.admin_id)
 * UNION las que tiene ASIGNADAS (user_instances).
 *
 * Antes solo se listaban las propias, así que un usuario con una instancia
 * asignada veía "Sin instancias" en /calendar y los turnos agendados por el
 * link público (que sí resuelve por user_instances) nunca aparecían.
 */
async function selectInstances(userId: string): Promise<{ rows: InstanceRow[]; freshCheck: boolean; error: unknown }> {
  const q = `
    SELECT ${BASE_COLUMNS}, status_checked_at FROM instances
    WHERE admin_id = ? OR id IN (SELECT instance_id FROM user_instances WHERE user_id = ?)
    ORDER BY created_at DESC`;
  const rows = await query<InstanceRow[]>(q, [userId, userId]);
  return { rows: rows || [], freshCheck: true, error: null };
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

  const { rows: instances, freshCheck, error } = await selectInstances(session.userId);
  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  // `role` estaba hardcodeado a "admin" para todos. No era un hole (el gating
  // real es server-side) pero el frontend lo leía: /whatsapp auto-seleccionaba
  // la instancia para cualquiera y /settings mostraba el botón "Nueva
  // instancia" y el badge Admin a usuarios normales.
  const me = await query<{ role: string }>("SELECT role FROM profiles WHERE id = ? LIMIT 1", [session.userId]);
  const role = me?.[0]?.role === "admin" ? "admin" : "user";

  if (lite) {
    return NextResponse.json({ status: "success", data: instances.map(sanitizeInstance), role });
  }
  const live = await withLiveStatus(instances, freshCheck);
  return NextResponse.json({ status: "success", data: live, role });
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

  // Gating por plan: límite de instancias según suscripción activa + add-ons.
  const limit = await checkInstanceLimit(session.userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { status: "error", error: limit.reason, code: limit.code, used: limit.used, max: limit.max },
      { status: 403 }
   );
  }

  const serverCheck = await testEvolutionConnection(normalizedUrl, evolutionApiKey);
  if (!serverCheck.ok) {
    const hint = serverCheck.status === 401 || serverCheck.status === 403 ? " (API key global de Evolution inválida)" : serverCheck.status === 404 ? " (URL mal)" : "";
    return NextResponse.json({ status: "error", error: `Servidor no responde: ${serverCheck.message}${hint}` }, { status: 400 });
  }

  // `instances.id` es VARCHAR sin AUTO_INCREMENT → `insertId` de mysql2 siempre
  // da 0. Se generaba el id a mano y se devolvía `insertId` (0), así que el
  // admin recibía instanceId: 0 y la asignación posterior fallaba siempre.
  const id = generateId();
  await query(
    "INSERT INTO instances (id, admin_id, instance_name, evolution_api_url, evolution_api_key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'connecting', NOW(), NOW())",
    [id, session.userId, cleanName, normalizedUrl, evolutionApiKey]
  );

  return NextResponse.json({
    status: "success",
    data: { id, instance_name: cleanName, status: "connecting", created_at: new Date().toISOString() },
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

  const inst = await query<{ id: string; admin_id: string }>(
    "SELECT id, admin_id FROM instances WHERE id = ? LIMIT 1",
    [id]
  );
  if (!inst.length || inst[0].admin_id !== session.userId) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  await query("DELETE FROM instances WHERE id = ?", [id]);
  return NextResponse.json({ status: "success" });
}
