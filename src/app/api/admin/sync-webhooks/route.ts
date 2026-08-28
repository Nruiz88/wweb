import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { setWebhook } from "@/lib/evolution-multi";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST: Re-sync webhooks for all instances in Evolution API
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

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
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
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
