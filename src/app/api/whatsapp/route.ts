import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { rateLimitResponse } from "@/lib/rate-limit";
import {
  connectInstance,
  createInstance,
  getConnectionState,
  logoutInstance,
  setWebhook,
} from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

// Evolution regenera el QR en cada /instance/connect.
// Cachear el QR evita invalidarlo con cada polling del panel.
const qrCache = new Map<string, { base64: string; at: number }>();
const QR_TTL_MS = 20000;

// Cada instancia = una conexion WhatsApp (RAM en Railway).
// Al preparar una instancia la registramos en Evolution (si falta) y
// configuramos su webhook para que las auto-respuestas funcionen.
async function prepareInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string
) {
  await createInstance(baseUrl, apiKey, instanceName);

  const secret = process.env.WEBHOOK_SECRET;
  const result = await setWebhook(
    baseUrl,
    apiKey,
    instanceName,
    webhookUrl,
    ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
    secret ? { "x-webhook-secret": secret } : {}
  );

  if (!result.ok && result.status === 401) {
    // La instancia puede no soportar /webhook/set con esta clave; no es bloqueante.
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

async function getAuthUser() {
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sessionClient = createSSRClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  return user;
}

// GET: Get instance status + QR code
export async function GET(request: Request) {
  const webhookUrl = buildWebhookUrl(request);
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await createServerClient();

  // Get user's assigned instance
  const { data: assignment } = await supabase
    .from("user_instances")
    .select("instance_id, instances(id, instance_name, evolution_api_url, evolution_api_key, status)")
    .eq("user_id", user.id)
    .single();

  if (!assignment) {
    return NextResponse.json(
      { status: "error", error: "No tienes una instancia asignada" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = (assignment as any).instances;
  if (!instance) {
    return NextResponse.json(
      { status: "error", error: "Instancia no encontrada" },
      { status: 404 }
    );
  }

  // Check connection state with Evolution API
  const stateResult = await getConnectionState(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name
  );

  let currentState = instance.status;
  if (stateResult.ok) {
    currentState = stateResult.data;
    // Update status in DB
    await supabase
      .from("instances")
      .update({ status: stateResult.data })
      .eq("id", instance.id);
  }

  // If state is qrcode or close, try to connect and get QR
  let qrCode: string | null = null;
  if (currentState === "close" || currentState === "qrcode" || currentState === "connecting") {
    const key = cacheKey(instance.evolution_api_url, instance.instance_name);
    const cached = qrCache.get(key);

    if (cached && Date.now() - cached.at < QR_TTL_MS) {
      qrCode = cached.base64;
    } else {
      if (webhookUrl) {
        await prepareInstance(
          instance.evolution_api_url,
          instance.evolution_api_key,
          instance.instance_name,
          webhookUrl
        );
      }

      const qrResult = await connectInstance(
        instance.evolution_api_url,
        instance.evolution_api_key,
        instance.instance_name
      );

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
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-connect", {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const webhookUrl = buildWebhookUrl(request);

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await createServerClient();

  const { data: assignment } = await supabase
    .from("user_instances")
    .select("instance_id, instances(id, instance_name, evolution_api_url, evolution_api_key)")
    .eq("user_id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = (assignment as any)?.instances;
  if (!instance) {
    return NextResponse.json(
      { status: "error", error: "No tienes una instancia asignada" },
      { status: 404 }
    );
  }

  if (webhookUrl) {
    await prepareInstance(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      webhookUrl
    );
  }

  const result = await connectInstance(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name
  );

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message },
      { status: 500 }
    );
  }

  // Update status
  await supabase
    .from("instances")
    .update({ status: "qrcode" })
    .eq("id", instance.id);

  let qrCode = result.data?.base64 || result.data?.b64 || null;
  if (qrCode && !qrCode.startsWith("data:")) {
    qrCode = `data:image/png;base64,${qrCode}`;
  }

  if (qrCode) {
    qrCache.set(
      cacheKey(instance.evolution_api_url, instance.instance_name),
      { base64: qrCode, at: Date.now() }
    );
  }

  return NextResponse.json({
    status: "success",
    data: { qrCode },
  });
}

// DELETE: Logout instance
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-logout", {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { status: "error", error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await createServerClient();

  const { data: assignment } = await supabase
    .from("user_instances")
    .select("instance_id, instances(id, instance_name, evolution_api_url, evolution_api_key)")
    .eq("user_id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = (assignment as any)?.instances;
  if (!instance) {
    return NextResponse.json(
      { status: "error", error: "No tienes una instancia asignada" },
      { status: 404 }
    );
  }

  const result = await logoutInstance(
    instance.evolution_api_url,
    instance.evolution_api_key,
    instance.instance_name
  );

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message },
      { status: 500 }
    );
  }

  // Update status
  await supabase
    .from("instances")
    .update({ status: "close" })
    .eq("id", instance.id);

  qrCache.delete(cacheKey(instance.evolution_api_url, instance.instance_name));

  return NextResponse.json({ status: "success" });
}
