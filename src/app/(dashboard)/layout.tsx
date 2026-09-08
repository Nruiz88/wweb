"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase/client";
import {
  HomeIcon,
  MessageCircleIcon,
  ZapIcon,
  ClockIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo";
import { CommandPalette } from "@/components/command-palette";
import { PlanProvider, usePlanContext } from "@/components/plan-context";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";

type NavChild = { href: string; label: string };

const BASE_NAV: { href: string; label: string; icon: typeof HomeIcon; children?: NavChild[] }[] = [
  { href: "/dashboard", label: "Inicio", icon: HomeIcon },
  { href: "/whatsapp", label: "Mi WhatsApp", icon: MessageCircleIcon },
  {
    href: "/auto-responses",
    label: "Bot",
    icon: ZapIcon,
    children: [
      { href: "/auto-responses", label: "Auto-Respuestas" },
      { href: "/menus", label: "Menús interactivos" },
      { href: "/catalog", label: "Catálogo" },
      { href: "/orders", label: "Pedidos" },
    ],
  },
];

const CALENDAR_NAV = {
  href: "/calendar",
  label: "Calendario",
  icon: CalendarIcon,
  children: [
    { href: "/calendar", label: "Ver turnos" },
    { href: "/calendar?config=1", label: "Horarios" },
  ],
};

const PLAN_NAV: Record<string, { href: string; label: string; icon: typeof HomeIcon; children?: NavChild[] }[]> = {
  pro: [CALENDAR_NAV],
};

const TAIL_NAV = [
  { href: "/logs", label: "Actividad", icon: ClockIcon },
  { href: "/profile", label: "Mi Perfil", icon: UserIcon },
];

const ADMIN_EXTRA = [
  { href: "/admin", label: "Admin", icon: ShieldIcon },
  { href: "/settings", label: "Configuración", icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PlanProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Rol/plan/usuario vienen del PlanProvider (1 solo fetch compartido con
  // todas las páginas que usan useUserPlan, sin requests duplicados).
  const { isAdmin, plan: userPlan, userName } = usePlanContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarBotOpen, setSidebarBotOpen] = useState(true);
  const [sidebarCalendarOpen, setSidebarCalendarOpen] = useState(true);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = useMemo(() => {
    const items = [...BASE_NAV];
    if (isAdmin) {
      // Admin sees everything
      items.push(CALENDAR_NAV);
    } else if (userPlan) {
      // Users see only features for their plan
      const planItems = PLAN_NAV[userPlan];
      if (planItems) items.push(...planItems);
    }
    items.push(...TAIL_NAV);
    if (isAdmin) items.push(...ADMIN_EXTRA);
    return items;
  }, [isAdmin, userPlan]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ===== SIDEBAR DESKTOP (convencional, todo visible) ===== */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
          <LogoMark />
          <span className="text-sm font-bold">Boti</span>
          {isAdmin && <Badge className="ml-auto bg-primary/10 text-primary border-transparent text-[10px]">Admin</Badge>}
        </div>

        <div className="px-3 py-3 border-b border-border">
          <CommandPalette />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Principal — siempre visible */}
          <div>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Principal</p>
            <div className="space-y-1">
              {BASE_NAV.filter((i) => !i.children).map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} prefetch={false} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
              {/* Bot — menú desplegable con estilo distintivo */}
              {BASE_NAV.filter((i) => i.children).map((group) => {
                const Icon = group.icon;
                const anyActive = group.children!.some((c) => pathname === c.href.split("?")[0]);
                return (
                  <div key={group.href} className="rounded-xl border border-border/60 bg-muted/20 p-1.5">
                    <button
                      type="button"
                      onClick={() => setSidebarBotOpen((v) => !v)}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-widest transition", anyActive ? "bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}
                    >
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg", anyActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {group.label}
                      <span className="ml-auto flex items-center gap-1.5">
                        <Badge variant="secondary" className="hidden text-[9px] px-1.5 py-0 border-transparent bg-background">{group.children!.length}</Badge>
                        <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", sidebarBotOpen ? "rotate-180" : "")} />
                      </span>
                    </button>
                    <AnimatePresence>
                      {sidebarBotOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                          <div className="mt-1.5 space-y-1 border-t border-border/40 pt-1.5">
                            {group.children!.map((child) => {
                              const active = pathname === child.href.split("?")[0];
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  prefetch={false}
                                  className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition relative", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active ? "bg-primary-foreground" : "bg-muted-foreground/40")} />
                                  {child.label}
                                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />}
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {(isAdmin || (userPlan && PLAN_NAV[userPlan])) && (
                <>
                  {(isAdmin ? [CALENDAR_NAV] : PLAN_NAV[userPlan!] || []).map((item) => {
                    const Icon = item.icon;
                    if (item.children && item.children.length > 0) {
                      const anyActive = item.children.some((c) => pathname === c.href.split("?")[0]);
                      const isOpen = sidebarCalendarOpen;
                      return (
                        <div key={item.href} className="rounded-xl border border-border/60 bg-muted/20 p-1.5">
                          <button type="button" onClick={() => setSidebarCalendarOpen((v) => !v)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-bold uppercase tracking-widest transition", anyActive ? "bg-card shadow-sm border border-border text-foreground" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}>
                            <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg", anyActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            {item.label}
                            <span className="ml-auto flex items-center gap-1.5">
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-transparent text-[9px] px-1.5 py-0">Pro</Badge>
                              <ChevronDownIcon className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")} />
                            </span>
                          </button>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                                <div className="mt-1.5 space-y-1 border-t border-border/40 pt-1.5">
                                  {item.children.map((child) => {
                                    const search = typeof window !== "undefined" ? window.location.search : "";
                                    const active = child.href === "/calendar?config=1" ? pathname === "/calendar" && search.includes("config=1") : pathname === "/calendar" && !search.includes("config=1");
                                    return (
                                      <Link key={child.href} href={child.href} prefetch={false} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", active ? "bg-primary-foreground" : "bg-muted-foreground/40")} />
                                        {child.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    }
                    const active = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} prefetch={false} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                        <Icon className="h-4 w-4" /> {item.label}
                        <Badge variant="secondary" className="ml-auto text-[9px] bg-amber-500/10 text-amber-600 border-transparent">Pro</Badge>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Cuenta</p>
            <div className="space-y-1">
              {TAIL_NAV.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} prefetch={false} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
              {isAdmin && ADMIN_EXTRA.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} prefetch={false} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-border p-3 space-y-3">
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs font-semibold text-primary">¿Necesitás ayuda?</p>
            <p className="text-[11px] text-muted-foreground">Dashboard te guía paso a paso. Empezá por Mi WhatsApp.</p>
            <Link href="/dashboard" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Ir a Inicio →</Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{userName[0]?.toUpperCase() || "?"}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{userName || "Usuario"}</p>
              {userPlan && <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0 border-transparent", userPlan === "pro" ? "bg-primary/10 text-primary" : "bg-[#53bdeb]/10 text-[#53bdeb]")}>{userPlan === "pro" ? "Pro" : "Starter"}</Badge>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => void handleLogout()} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
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
            {isAdmin && <Badge variant="secondary" className={cn("bg-[#00a884]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#00a884] border-transparent")}>Admin</Badge>}
            {userPlan && (
              <Badge
                variant="secondary"
                className={cn(
                  "px-1.5 py-0.5 text-[8px] font-semibold border-transparent",
                  userPlan === "pro" ? "bg-primary/10 text-primary" : "bg-[#53bdeb]/10 text-[#53bdeb]"
                )}
              >
                {userPlan === "starter" ? "Starter" : "Pro"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-wa-border bg-wa-panel lg:hidden max-h-[calc(100dvh-60px)] overflow-y-auto"
          >
            <div className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                if (item.children && item.children.length > 0) {
                  return (
                    <div key={item.href} className="space-y-1">
                      <div className="flex items-center gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        <Icon className="h-4 w-4" /> {item.label}
                      </div>
                      {item.children.map((child) => {
                        const childActive = pathname === child.href.split("?")[0];
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={false}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "ml-4 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition border-l-2",
                              childActive
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-transparent text-wa-text-secondary hover:bg-accent hover:text-wa-text"
                            )}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                }
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-[#00a884]/10 text-[#00a884]"
                        : "text-wa-text-secondary hover:bg-accent hover:text-wa-text"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-wa-border pt-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={() => void handleLogout()}
                  className="flex w-full justify-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-400 h-auto"
                >
                  <LogOut className="h-5 w-5" />
                  Cerrar sesion
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-background">{children}</div>
      </div>
    </div>
  );
}
