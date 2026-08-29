"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
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
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/5 bg-surface-dim/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-[#00a884] transition-transform hover:scale-95">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 5.9 2 10.7c0 2.5 1.15 4.75 3.02 6.35L3.94 21l4.23-2.39c1.12.32 2.33.5 3.58.5h.06c5.52 0 10-3.9 10-8.7S17.52 2 12 2Z" />
            <circle cx="8.5" cy="10.5" r="1.2" fill="#0a151a" />
            <circle cx="12" cy="10.5" r="1.2" fill="#0a151a" />
            <circle cx="15.5" cy="10.5" r="1.2" fill="#0a151a" />
          </svg>
          Boti
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <a
            href="#funcionalidades"
            className="rounded-xl border border-transparent px-3 py-2 font-mono text-[14px] font-medium text-text-secondary transition-all duration-200 hover:border-whatsapp-green/20 hover:bg-white/5 hover:text-white hover:shadow-[0_0_15px_rgba(37,211,102,0.1)]"
          >
            Funcionalidades
          </a>
          <a
            href="#precios"
            className="rounded-xl border border-transparent px-3 py-2 font-mono text-[14px] font-medium text-text-secondary transition-all duration-200 hover:border-whatsapp-green/20 hover:bg-white/5 hover:text-white hover:shadow-[0_0_15px_rgba(37,211,102,0.1)]"
          >
            Precios
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <a href="/dashboard" className="hidden font-mono text-[14px] text-text-secondary transition-colors hover:text-white md:block">
                Mi Panel
              </a>
              <a
                href="/dashboard"
                className="flex items-center gap-2 rounded-full bg-[#00a884] px-5 py-2.5 font-mono text-[14px] font-bold text-white shadow-[0_0_15px_rgba(0,168,132,0.3)] transition-colors hover:bg-[#008f6f]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                  {(user.email?.[0] ?? "U").toUpperCase()}
                </span>
                {user.email?.split("@")[0]}
              </a>
            </>
          ) : (
            <>
              <a href="/login" className="hidden font-mono text-[14px] text-text-secondary transition-colors hover:text-white md:block">
                Iniciar sesión
              </a>
              <a
                href="/register"
                className="rounded-full bg-[#00a884] px-5 py-2.5 font-mono text-[14px] font-bold text-white shadow-[0_0_15px_rgba(0,168,132,0.3)] transition-colors hover:bg-[#008f6f]"
              >
                Registrarse
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}