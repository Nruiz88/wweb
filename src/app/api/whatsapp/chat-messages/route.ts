import { NextResponse } from "next/server";
import { findMessages } from "@/lib/evolution";

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

  const { remoteJid, limit } = (body ?? {}) as {
    remoteJid?: unknown;
    limit?: unknown;
  };

  if (typeof remoteJid !== "string" || remoteJid.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo remoteJid es obligatorio", data: null },
      { status: 400 }
    );
  }

  const result = await findMessages(
    remoteJid.trim(),
    typeof limit === "number" && limit > 0 && limit <= 200 ? limit : 30
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
    data: { messages: result.data },
  });
}
