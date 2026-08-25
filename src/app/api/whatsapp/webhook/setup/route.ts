import { NextResponse } from "next/server";
import { setInstanceWebhook } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const webhookUrl = `${proto}://${host}/api/whatsapp/webhook`;

  const isLocal =
    host.includes("localhost") ||
    host.startsWith("127.") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.");

  if (isLocal) {
    return NextResponse.json(
      {
        status: "error",
        error:
          "El webhook debe apuntar a una URL pública. En local usa un túnel (ngrok) y desplegado en Vercel apunta a tu dominio de producción.",
        data: null,
      },
      { status: 400 }
    );
  }

  const result = await setInstanceWebhook(webhookUrl, [
    "MESSAGES_UPSERT",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
  ]);

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "success",
    error: null,
    data: { url: webhookUrl, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"] },
  });
}
