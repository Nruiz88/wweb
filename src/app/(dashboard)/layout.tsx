"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  HomeIcon,
  MessageCircleIcon,
  ZapIcon,
  ClockIcon,
  SettingsIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/logo";

const USER_NAV = [
  { href: "/dashboard", label: "Inicio", icon: HomeIcon },
  { href: "/whatsapp", label: "Mi WhatsApp", icon: MessageCircleIcon },
  { href: "/auto-responses", label: "Auto-Respuestas", icon: ZapIcon },
  { href: "/logs", label: "Actividad", icon: ClockIcon },
  { href: "/profile", label: "Mi Perfil", icon: UserIcon },
];

const ADMIN_NAV = [
  { href: "/dashboard", label: "Inicio", icon: HomeIcon },
  { href: "/whatsapp", label: "Mi WhatsApp", icon: MessageCircleIcon },
  { href: "/auto-responses", label: "Auto-Respuestas", icon: ZapIcon },
  { href: "/logs", label: "Actividad", icon: ClockIcon },
  { href: "/admin", label: "Admin", icon: ShieldIcon },
  { href: "/settings", label: "Configuracion", icon: SettingsIcon },
  { href: "/profile", label: "Mi Perfil", icon: UserIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (user) {
          setUserName(user.user_metadata?.full_name || user.email || "");
          // Determinar rol via /api/auth/me (usa service role, sin RLS
          // ni llamadas a Evolution API)
          try {
            const res = await fetch("/api/auth/me");
            const payload = await res.json();
            if (!cancelled && payload.status === "success" && payload.data?.role === "admin") {
              setIsAdmin(true);
              if (payload.data.full_name) setUserName(payload.data.full_name);
            }
            // Fetch subscription plan
            try {
              const subRes = await fetch("/api/profile");
              const subPayload = await subRes.json();
              if (!cancelled && subPayload.status === "success" && subPayload.data?.subscription) {
                setUserPlan(subPayload.data.subscription.plan_type);
              }
            } catch { /* non-critical */ }
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
    router.push("/login");
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
    <div className="flex h-full flex-col bg-background">
      {/* ===== DESKTOP TOP NAV (lg+) ===== */}
      <header className="hidden border-b border-wa-border bg-wa-panel lg:flex">
        <div className="flex w-full items-center px-4 xl:px-6">
          {/* Logo */}
          <a href="/dashboard" className="flex items-center gap-2.5 py-3 pr-6 border-r border-wa-border mr-4">
            <LogoMark />
            <span className="text-sm font-bold text-wa-text">Boti</span>
          </a>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-[#00a884]/10 text-[#00a884]"
                      : "text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Right side: user + logout */}
          <div className="flex items-center gap-4 pl-4 border-l border-wa-border">
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#00a884]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00a884]">
                <ShieldIcon className="h-3 w-3" />
                Admin
              </span>
            )}
            {userPlan && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: userPlan === "pro" ? "#00a88415" : userPlan === "community" ? "#e6a44e15" : "#53bdeb15",
                  color: userPlan === "pro" ? "#00a884" : userPlan === "community" ? "#e6a44e" : "#53bdeb",
                }}
              >
                {userPlan === "starter" ? "Starter" : userPlan === "pro" ? "Pro" : "Community"}
              </span>
            )}
            <span className="text-xs text-wa-text-secondary truncate max-w-[120px]">{userName}</span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
            >
              <LogOutIcon className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ===== MOBILE HEADER (< lg) ===== */}
      <div className="flex items-center gap-3 border-b border-wa-border bg-wa-header px-4 py-3 lg:hidden">
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
        <LogoMark />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-wa-text">Boti</p>
            {isAdmin && <span className="rounded-full bg-[#00a884]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#00a884]">Admin</span>}
            {userPlan && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                style={{
                  backgroundColor: userPlan === "pro" ? "#00a88415" : userPlan === "community" ? "#e6a44e15" : "#53bdeb15",
                  color: userPlan === "pro" ? "#00a884" : userPlan === "community" ? "#e6a44e" : "#53bdeb",
                }}
              >
                {userPlan === "starter" ? "Starter" : userPlan === "pro" ? "Pro" : "Community"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-wa-border bg-wa-panel p-3 space-y-1 lg:hidden">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
