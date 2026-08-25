import { NextResponse } from "next/server";
import { getConnectionState, getQrCode, sendTextMessage } from "@/lib/evolution";

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

  const { number, text, delay } = (body ?? {}) as {
    number?: unknown;
    text?: unknown;
    delay?: unknown;
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

  const result = await sendTextMessage(
    number.trim(),
    text.trim(),
    typeof delay === "number" ? delay : undefined
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
