import { NextResponse } from "next/server";
import {
  sendMediaMessage,
  sendStickerMessage,
  sendWhatsAppAudio,
  type MediaType,
  type SendMediaPayload,
} from "@/lib/evolution";

export const dynamic = "force-dynamic";

type MediaKind = MediaType | "ptt" | "sticker";

const MEDIA_KINDS: MediaKind[] = ["image", "document", "video", "audio", "ptt", "sticker"];

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", error: "JSON inválido en el cuerpo de la petición", data: null },
      { status: 400 }
    );
  }

  const { number, kind, media, caption, fileName, mimetype, delay } = (body ?? {}) as {
    number?: unknown;
    kind?: unknown;
    media?: unknown;
    caption?: unknown;
    fileName?: unknown;
    mimetype?: unknown;
    delay?: unknown;
  };

  if (typeof number !== "string" || number.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo number es obligatorio", data: null },
      { status: 400 }
    );
  }

  if (typeof kind !== "string" || !MEDIA_KINDS.includes(kind as MediaKind)) {
    return NextResponse.json(
      { status: "error", error: "El campo kind debe ser image, document, video, audio, ptt o sticker", data: null },
      { status: 400 }
    );
  }

  if (typeof media !== "string" || media.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo media (base64 o URL) es obligatorio", data: null },
      { status: 400 }
    );
  }

  const delayMs = typeof delay === "number" && delay >= 0 ? delay : undefined;

  if (kind === "ptt") {
    const result = await sendWhatsAppAudio(number.trim(), media.trim(), delayMs);

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", error: result.message, data: null },
        { status: 502 }
      );
    }

    return NextResponse.json({ status: "success", error: null, data: result.data });
  }

  if (kind === "sticker") {
    const result = await sendStickerMessage(number.trim(), media.trim());

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", error: result.message, data: null },
        { status: 502 }
      );
    }

    return NextResponse.json({ status: "success", error: null, data: result.data });
  }

  const payload: SendMediaPayload = {
    number: number.trim(),
    mediatype: kind as MediaType,
    media: media.trim(),
  };

  if (typeof caption === "string" && caption.trim() !== "") {
    payload.caption = caption.trim();
  }
  if (typeof fileName === "string" && fileName.trim() !== "") {
    payload.fileName = fileName.trim();
  }
  if (typeof mimetype === "string" && mimetype.trim() !== "") {
    payload.mimetype = mimetype.trim();
  }
  if (delayMs !== undefined) {
    payload.delay = delayMs;
  }

  const result = await sendMediaMessage(payload);

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
