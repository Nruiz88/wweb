import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

// For API routes: use service role key (bypasses RLS)
export async function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return createClient(supabaseConfig.url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

// For getting the current user from cookies
export async function getCurrentUser(requestCookies?: string) {
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const cookieStore = await import("next/headers").then((m) => m.cookies());

  const supabase = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
