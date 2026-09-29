import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Check if onboarding is completed
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const profiles = await query<{ onboarding_completed: boolean }>(
    "SELECT onboarding_completed FROM profiles WHERE id = ? LIMIT 1",
    [session.userId]
  );

  const completed = profiles?.[0]?.onboarding_completed ?? false;

  return NextResponse.json({
    status: "success",
    data: { completed },
  });
}

// PUT: Mark onboarding as completed
export async function PUT() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  await query(
    "UPDATE profiles SET onboarding_completed = true WHERE id = ?",
    [session.userId]
  );

  return NextResponse.json({ status: "success" });
}
