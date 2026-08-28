import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

/**
 * Shared admin authentication helper.
 * Returns { user, supabase } if the request is from an admin,
 * or a NextResponse error if not.
 *
 * Usage in any admin API route:
 *
 *   const auth = await requireAdmin();
 *   if ("error" in auth) return auth.error;
 *   const { user, supabase } = auth;
 */
export async function requireAdmin() {
  // Get user from session cookies
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const sessionClient = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await sessionClient.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) };
  }

  // Verify admin role via service role
  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }) };
  }

  return { user, supabase };
}
