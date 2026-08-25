import { NextResponse } from "next/server";
import { sendLocationMessage } from "@/lib/evolution";

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

  const { number, latitude, longitude, name, address } = (body ?? {}) as {
    number?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    name?: unknown;
    address?: unknown;
  };

  if (typeof number !== "string" || number.trim() === "") {
    return NextResponse.json(
      { status: "error", error: "El campo number es obligatorio", data: null },
      { status: 400 }
    );
  }

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json(
      { status: "error", error: "Los campos latitude y longitude son obligatorios", data: null },
      { status: 400 }
    );
  }

  const payload: {
    number: string;
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  } = {
    number: number.trim(),
    latitude,
    longitude,
  };

  if (typeof name === "string" && name.trim() !== "") {
    payload.name = name.trim();
  }
  if (typeof address === "string" && address.trim() !== "") {
    payload.address = address.trim();
  }

  const result = await sendLocationMessage(payload);

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  return NextResponse.json({ status: "success", error: null, data: result.data });
}
