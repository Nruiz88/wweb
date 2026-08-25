"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  HomeIcon,
  MessageCircleIcon,
  ZapIcon,
  ClockIcon,
  SettingsIcon,
  LogOutIcon,
  ShieldIcon,
} from "@/components/icons";

const USER_NAV = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/whatsapp", label: "Mi WhatsApp", icon: MessageCircleIcon },
  { href: "/auto-responses", label: "Auto-Respuestas", icon: ZapIcon },
  { href: "/logs", label: "Actividad", icon: ClockIcon },
];

const ADMIN_NAV = [
  ...USER_NAV,
  { href: "/settings", label: "Configuracion", icon: SettingsIcon },
  { href: "/admin", label: "Admin", icon: ShieldIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (user) {
          setUserName(user.user_metadata?.full_name || user.email || "");
          try {
            const res = await fetch("/api/instances");
            const payload = await res.json();
            if (!cancelled && payload.role === "admin") setIsAdmin(true);
          } catch { /* non-critical */ }
        }
      } catch { /* auth error */ }
      finally { if (!cancelled) setLoaded(true); }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navItems = isAdmin ? ADMIN_NAV : USER_NAV;

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-wa-border bg-wa-panel lg:flex">
        {/* Logo + user */}
        <div className="border-b border-wa-border px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#00a884]/15 text-[#00a884]">
              <MessageCircleIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-wa-text">Bot WhatsApp</p>
              <p className="truncate text-[11px] text-wa-text-secondary">{userName}</p>
            </div>
          </div>
          {isAdmin && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00a884]/10 px-2.5 py-1 text-[10px] font-semibold text-[#00a884]">
                <ShieldIcon className="h-3 w-3" />
                Administrador
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#00a884]/10 text-[#00a884]"
                    : "text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-wa-border px-3 py-4">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
          >
            <LogOutIcon className="h-5 w-5" />
            Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex flex-1 flex-col lg:hidden">
        {/* Mobile header */}
        <div className="flex items-center gap-3 border-b border-wa-border bg-wa-header px-4 py-3">
          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="icon-btn h-9 w-9">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </>
              )}
            </svg>
          </button>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884]">
            <MessageCircleIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-wa-text">Bot WhatsApp</p>
              {isAdmin && <span className="rounded-full bg-[#00a884]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#00a884]">Admin</span>}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-b border-wa-border bg-wa-panel p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-[#00a884]/10 text-[#00a884]"
                      : "text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </a>
              );
            })}
            <div className="border-t border-wa-border pt-2 mt-2">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
              >
                <LogOutIcon className="h-5 w-5" />
                Cerrar sesion
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>

      {/* Desktop content */}
      <div className="hidden flex-1 overflow-y-auto lg:flex">{children}</div>
    </div>
  );
}
