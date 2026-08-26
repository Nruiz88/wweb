import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Rol del usuario autenticado (ligero, sin llamadas a Evolution)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    status: "success",
    data: {
      id: user.id,
      email: user.email,
      role: profile?.role ?? "user",
      full_name: profile?.full_name ?? null,
    },
  });
}