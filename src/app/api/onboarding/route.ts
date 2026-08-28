import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Check if onboarding is completed
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  // If column doesn't exist yet, treat onboarding as not completed
  if (error) {
    console.warn("[onboarding] column may not exist yet:", error.message);
    return NextResponse.json({ status: "success", data: { completed: false } });
  }

  return NextResponse.json({
    status: "success",
    data: { completed: data?.onboarding_completed ?? false },
  });
}

// PUT: Mark onboarding as completed
export async function PUT() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (error) {
    // If column doesn't exist, silently succeed (migration pending)
    console.warn("[onboarding] update failed (column may not exist):", error.message);
  }

  return NextResponse.json({ status: "success" });
}
