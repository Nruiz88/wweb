import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  connectInstance,
  getConnectionState,
  logoutInstance,
} from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

// Evolution regenera el QR en cada /instance/connect.
// Cachear el QR evita invalidarlo con cada polling del panel.
const qrCache = new Map<string, { base64: string; at: number }>();
const QR_TTL_MS = 20000;

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
export async function GET() {
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
export async function POST() {
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
export async function DELETE() {
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
