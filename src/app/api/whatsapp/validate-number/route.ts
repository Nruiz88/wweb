import { NextResponse } from "next/server";
import { validateWhatsAppNumbers } from "@/lib/evolution";

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

  const { number } = (body ?? {}) as { number?: unknown };

  if (typeof number !== "string" || number.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo number es obligatorio", data: null },
      { status: 400 }
    );
  }

  const result = await validateWhatsAppNumbers([number.trim()]);

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  const match = result.data[0];

  return NextResponse.json({
    status: "success",
    error: null,
    data: {
      number: number.trim(),
      exists: match?.exists ?? false,
      name: match?.name ?? null,
      jid: match?.jid ?? null,
    },
  });
}
