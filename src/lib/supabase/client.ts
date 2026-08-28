import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

/**
 * Lazy-initialized Supabase browser client.
 * Created on first use, not at module scope — avoids prerender errors
 * when env vars are unavailable during static build.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabase() {
  if (!_client && supabaseConfig.url && supabaseConfig.anonKey) {
    _client = createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
  }
  return _client!;
}

// Lazy export: `import { supabase } from "@/lib/supabase/client"` still works
// but the client is only created on first property access at runtime.
let _proxy: ReturnType<typeof createBrowserClient> | null = null;
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_, prop) {
    if (!_proxy) _proxy = getSupabase();
    return Reflect.get(_proxy, prop);
  },
});
