import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";
import { rateLimitResponse } from "../../../lib/rate-limit";
import {
  connectInstance,
  createInstance,
  getConnectionState,
  logoutInstance,
  setWebhook,
} from "../../../lib/evolution-multi";

export const dynamic = "force-dynamic";

const qrCache = new Map<string, { base64: string; at: number }>();
const QR_TTL_MS = 20000;
const recentLogout = new Map<string, number>();
const LOGOUT_GRACE_MS = 15000;

async function prepareInstance(baseUrl: string, apiKey: string, instanceName: string, webhookUrl: string) {
  await createInstance(baseUrl, apiKey, instanceName);
  const secret = process.env.WEBHOOK_SECRET;
  const result = await setWebhook(baseUrl, apiKey, instanceName, webhookUrl, ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"], secret ? { "x-webhook-secret": secret } : {});
  if (!result.ok && result.status === 401) {
    return;
  }
}

function buildWebhookUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.168.")) {
    return "";
  }
  return `${proto}://${host}/api/webhook`;
}

function cacheKey(baseUrl: string, instanceName: string): string {
  return `${baseUrl}|${instanceName}`;
}

interface ResolvedInstance {
  id: string;
  instance_name: string;
  evolution_api_url: string;
  evolution_api_key: string;
  status?: string;
}

async function resolveInstance(userId: string, selectedInstanceId?: string | null): Promise<ResolvedInstance | null> {
  const [{ rows: instances }] = await query<{ id: string; instance_name: string; evolution_api_url: string; evolution_api_key: string; status: string }>(
    `SELECT id, instance_name, evolution_api_url, evolution_api_key, status FROM instances WHERE admin_id = ? ${selectedInstanceId ? "AND id = ?" : ""} ORDER BY created_at DESC LIMIT 1`,
    selectedInstanceId ? [userId, selectedInstanceId] : [userId]
  );
  if (instances?.length) {
    return {
      id: instances[0].id,
      instance_name: instances[0].instance_name,
      evolution_api_url: instances[0].evolution_api_url,
      evolution_api_key: instances[0].evolution_api_key,
      status: instances[0].status,
    };
  }

  const [{ rows: assignment }] = await query<{ instance_id: string }>(
    "SELECT instance_id FROM user_instances WHERE user_id = ? LIMIT 1",
    [userId]
  );
  if (!assignment?.length) return null;

  const [{ rows: inst }] = await query<{ id: string; instance_name: string; evolution_api_url: string; evolution_api_key: string; status: string }>(
    "SELECT id, instance_name, evolution_api_url, evolution_api_key, status FROM instances WHERE id = ? LIMIT 1",
    [assignment[0].instance_id]
  );
  if (!inst?.length) return null;

  return {
    id: inst[0].id,
    instance_name: inst[0].instance_name,
    evolution_api_url: inst[0].evolution_api_url,
    evolution_api_key: inst[0].evolution_api_key,
    status: inst[0].status,
  };
}

async function getAuthUser() {
  const session = await getSession();
  return session?.userId;
}

// GET: Get instance status + QR code
export async function GET(request: Request) {
  const webhookUrl = buildWebhookUrl(request);
  const userId = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const instance = await resolveInstance(userId);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes una instancia asignada" }, { status: 404 });
  }

  const stateResult = await getConnectionState(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
  let currentState = instance.status;
  if (stateResult.ok) {
    const key = cacheKey(instance.evolution_api_url, instance.instance_name);
    const justLoggedOut = recentLogout.has(key) && Date.now() - (recentLogout.get(key) ?? 0) < LOGOUT_GRACE_MS;
    if (justLoggedOut && stateResult.data === "open" && instance.status === "close") {
      currentState = "close";
    } else {
      currentState = stateResult.data;
      await query("UPDATE instances SET status = ? WHERE id = ?", [stateResult.data, instance.id]);
    }
    if (justLoggedOut && Date.now() - (recentLogout.get(key) ?? 0) >= LOGOUT_GRACE_MS) {
      recentLogout.delete(key);
    }
  }

  let qrCode: string | null = null;
  if (currentState === "close" || currentState === "qrcode" || currentState === "connecting") {
    const key = cacheKey(instance.evolution_api_url, instance.instance_name);
    const cached = qrCache.get(key);
    if (cached && Date.now() - cached.at < QR_TTL_MS) {
      qrCode = cached.base64;
    } else {
      if (webhookUrl) {
        await prepareInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name, webhookUrl);
      }
      const qrResult = await connectInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
      if (qrResult.ok && qrResult.data) {
        qrCode = qrResult.data.base64 || qrResult.data.b64 || null;
        if (qrCode && !qrCode.startsWith("data:")) {
          qrCode = `data:image/png;base64,${qrCode}`;
        }
        if (qrCode) {
          qrCache.set(key, { base64: qrCode, at: Date.now() });
        }
      }
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      instanceId: instance.id,
      instanceName: instance.instance_name,
      connectionState: currentState,
      qrCode,
    },
  });
}

// POST: Connect instance (get QR)
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-connect", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const webhookUrl = buildWebhookUrl(request);
  const userId = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const instance = await resolveInstance(userId);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes una instancia asignada" }, { status: 404 });
  }

  if (webhookUrl) {
    await prepareInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name, webhookUrl);
  }

  const result = await connectInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
  if (!result.ok) {
    return NextResponse.json({ status: "error", error: result.message }, { status: 500 });
  }

  await query("UPDATE instances SET status = 'qrcode' WHERE id = ?", [instance.id]);

  let qrCode = result.data?.base64 || result.data?.b64 || null;
  if (qrCode && !qrCode.startsWith("data:")) {
    qrCode = `data:image/png;base64,${qrCode}`;
  }
  if (qrCode) {
    qrCache.set(cacheKey(instance.evolution_api_url, instance.instance_name), { base64: qrCode, at: Date.now() });
  }

  return NextResponse.json({ status: "success", data: { qrCode } });
}

// DELETE: Logout instance
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-logout", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const userId = await getAuthUser();
  if (!userId) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const instance = await resolveInstance(userId);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes una instancia asignada" }, { status: 404 });
  }

  const result = await logoutInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);

  // Always mark as disconnected locally
  await query("UPDATE instances SET status = 'close' WHERE id = ?", [instance.id]);

  const key = cacheKey(instance.evolution_api_url, instance.instance_name);
  qrCache.delete(key);
  recentLogout.set(key, Date.now());

  if (!result.ok) {
    console.warn("[whatsapp] logout Evolution falló pero se marcó close", { instance: instance.instance_name, status: result.status, message: result.message });
  }

  return NextResponse.json({ status: "success" });
}
