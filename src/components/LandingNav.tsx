"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LogoFull } from "@/components/logo";
import type { User } from "@supabase/supabase-js";

export default function LandingNav() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: import("@supabase/supabase-js").User | null } }) => setUser(data.user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: import("@supabase/supabase-js").User } | null) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#111b21]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <LogoFull />
        <div className="hidden items-center gap-6 sm:flex">
          <a href="#como-funciona" className="text-sm text-gray-400 transition hover:text-white">
            Como funciona
          </a>
          <a href="#features" className="text-sm text-gray-400 transition hover:text-white">
            Funcionalidades
          </a>
          <a href="#precios" className="text-sm text-gray-400 transition hover:text-white">
            Precios
          </a>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <a
                href="/dashboard"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white"
              >
                Mi Panel
              </a>
              <a
                href="/dashboard"
                className="flex items-center gap-2 rounded-lg bg-[#00a884] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00a884]/90 hover:shadow-lg hover:shadow-[#00a884]/20"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                {user.email?.split("@")[0]}
              </a>
            </>
          ) : (
            <>
              <a href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white">
                Iniciar sesion
              </a>
              <a href="/register" className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00a884]/90 hover:shadow-lg hover:shadow-[#00a884]/20">
                Registrarse
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
