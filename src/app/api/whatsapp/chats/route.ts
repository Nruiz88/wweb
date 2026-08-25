import { NextResponse } from "next/server";
import { findChats } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await findChats();

  if (!result.ok) {
    return NextResponse.json(
      { status: "error", error: result.message, data: null },
      { status: 502 }
    );
  }

  return NextResponse.json({
    status: "success",
    error: null,
    data: { chats: result.data },
  });
}
