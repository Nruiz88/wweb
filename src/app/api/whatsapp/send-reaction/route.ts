import { NextResponse } from "next/server";
import { sendReaction } from "@/lib/evolution";

export const dynamic = "force-dynamic";

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

  const { remoteJid, messageId, fromMe, reaction } = (body ?? {}) as {
    remoteJid?: unknown;
    messageId?: unknown;
    fromMe?: unknown;
    reaction?: unknown;
  };

  if (typeof remoteJid !== "string" || remoteJid.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo remoteJid es obligatorio", data: null },
      { status: 400 }
    );
  }

  if (typeof messageId !== "string" || messageId.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo messageId es obligatorio", data: null },
      { status: 400 }
    );
  }

  if (typeof reaction !== "string") {
    return NextResponse.json(
      { status: "error", error: "El campo reaction es obligatorio", data: null },
      { status: 400 }
    );
  }

  const result = await sendReaction(
    remoteJid.trim(),
    messageId.trim(),
    Boolean(fromMe),
    reaction
  );

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  return NextResponse.json({ status: "success", error: null, data: result.data });
}
