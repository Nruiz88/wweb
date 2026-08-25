import { NextResponse } from "next/server";
import { restartInstance } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await restartInstance();

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
