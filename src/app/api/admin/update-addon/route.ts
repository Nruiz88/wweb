import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { userId, quantity } = (body ?? {}) as { userId?: string; quantity?: number };
  if (!userId || quantity == null || quantity < 0) return NextResponse.json({ status: "error", error: "userId y quantity requeridos" }, { status: 400 });

  // Update or create instance_addon for user (simplified: just insert/update active addon)
  const { error } = await supabase.from("instance_addons").upsert({
    user_id: userId,
    quantity: quantity,
    status: "active",
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  if (error) return NextResponse.json({ status: "error", error: "DB error" }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
