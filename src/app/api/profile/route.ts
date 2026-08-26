import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET: Get current user's profile
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, business_name, phone, address, created_at")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: profile });
}

// PUT: Update current user's profile
export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { full_name, business_name, phone, address } = (body ?? {}) as {
    full_name?: string;
    business_name?: string;
    phone?: string;
    address?: string;
  };

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      full_name: full_name ?? null,
      business_name: business_name ?? null,
      phone: phone ?? null,
      address: address ?? null,
    })
    .eq("id", user.id)
    .select("id, email, full_name, role, business_name, phone, address, created_at")
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: profile });
}
