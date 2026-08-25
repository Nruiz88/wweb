import { NextResponse } from "next/server";
import { addMessage, parseWebhookMessage } from "@/lib/messages";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const message = parseWebhookMessage(payload);

    if (message) {
      addMessage(message);
    }
  } catch {
    // Payloads inválidos se ignoran; siempre responder 200 para evitar reintentos de Evolution.
  }

  return NextResponse.json({ status: "success", error: null, data: null });
}
