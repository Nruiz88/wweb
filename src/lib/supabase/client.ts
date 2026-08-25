import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export const supabase = createBrowserClient(
  supabaseConfig.url,
  supabaseConfig.anonKey
);
