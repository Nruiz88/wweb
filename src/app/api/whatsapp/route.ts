import { NextResponse } from "next/server";
import {
  getConnectionState,
  getQrCode,
  sendPresence,
  sendTextMessage,
  type PresenceType,
} from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getConnectionState();

  if (!state.ok) {
    return NextResponse.json(
      { status: "error", error: state.message, data: null },
      { status: 502 }
    );
  }

  if (state.data === "open") {
    return NextResponse.json({
      status: "success",
      error: null,
      data: { state: state.data, qrcode: null },
    });
  }

  const qr = await getQrCode();

  if (!qr.ok) {
    return NextResponse.json(
      {
        status: "error",
        error: qr.message,
        data: { state: state.data, qrcode: null },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "success",
    error: null,
    data: { state: state.data, qrcode: qr.data.base64 ?? qr.data.b64 ?? null },
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "error",
        error: "JSON inválido en el cuerpo de la petición",
        data: null,
      },
      { status: 400 }
    );
  }

  const { number, text, delay, presence } = (body ?? {}) as {
    number?: unknown;
    text?: unknown;
    delay?: unknown;
    presence?: { type?: unknown; duration?: unknown };
  };

  if (typeof number !== "string" || number.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo number es obligatorio", data: null },
      { status: 400 }
    );
  }

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo text es obligatorio", data: null },
      { status: 400 }
    );
  }

  const presenceType = presence?.type;
  const wantsPresence =
    presenceType === "composing" || presenceType === "recording";

  if (wantsPresence) {
    const duration =
      typeof presence?.duration === "number"
        ? Math.min(Math.max(presence.duration, 500), 15000)
        : 3000;

    const presenceResult = await sendPresence(
      number.trim(),
      presenceType as PresenceType,
      duration
    );

    if (!presenceResult.ok) {
      return NextResponse.json(
        { status: "error", error: presenceResult.message, data: null },
        { status: 502 }
      );
    }

    await new Promise((resolve) => setTimeout(resolve, Math.min(duration, 4000)));
  }

  const result = await sendTextMessage(
    number.trim(),
    text.trim(),
    wantsPresence ? 0 : typeof delay === "number" ? delay : undefined
  );

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "success",
    error: null,
    data: result.data,
  });
}
