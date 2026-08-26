import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { setWebhook } from "@/lib/evolution-multi";

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

// POST: Re-sincroniza el webhook de todas las instancias en Evolution API.
// El webhook se configura al conectar; este endpoint lo aplica a las
// instancias existentes que nunca se reconectaron.
export async function POST(request: Request) {
  const user = await getAuthUser();
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

  const appUrl =
    process.env.APP_URL ||
    request.headers.get("x-forwarded-proto") + "://" +
    (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "");

  if (!appUrl || appUrl.startsWith("http://localhost") || appUrl.startsWith("https://localhost")) {
    return NextResponse.json(
      { status: "error", error: "APP_URL no configurado o entorno local" },
      { status: 400 }
    );
  }

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhook`;
  const secret = process.env.WEBHOOK_SECRET;

  const { data: instances, error } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key");

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  const events = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"];
  const headers: Record<string, string> = secret ? { "x-webhook-secret": secret } : {};
  const results: { instance_name: string; ok: boolean; message?: string }[] = [];

  for (const inst of instances ?? []) {
    const result = await setWebhook(
      inst.evolution_api_url,
      inst.evolution_api_key,
      inst.instance_name,
      webhookUrl,
      events,
      headers
    );

    results.push({
      instance_name: inst.instance_name,
      ok: result.ok,
      message: result.ok ? undefined : result.message,
    });
  }

  const okCount = results.filter((r) => r.ok).length;

  return NextResponse.json({
    status: "success",
    data: {
      webhook_url: webhookUrl,
      total: results.length,
      ok: okCount,
      failed: results.length - okCount,
      results,
    },
  });
}