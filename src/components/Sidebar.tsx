"use client";

import {
  InboxIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  ShieldIcon,
} from "@/components/icons";

export type ViewId = "panel" | "conversaciones" | "recibidos";

const NAV_ITEMS: { id: ViewId; label: string; icon: typeof LayoutDashboardIcon }[] = [
  { id: "panel", label: "Panel", icon: LayoutDashboardIcon },
  { id: "conversaciones", label: "Conversaciones", icon: MessageCircleIcon },
  { id: "recibidos", label: "Recibidos", icon: InboxIcon },
];

interface SidebarProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
}

export function Sidebar({ view, onNavigate }: SidebarProps) {
  return (
    <aside className="glass-panel flex shrink-0 flex-col gap-6 p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-56">
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <ShieldIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-100">Panel WhatsApp</p>
          <p className="text-[11px] text-slate-500">Evolution API v2</p>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto lg:flex-col">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`btn-base shrink-0 justify-start gap-3 px-3 py-2.5 text-sm ${
                active
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/40"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <p className="mt-auto hidden px-1 text-[11px] leading-relaxed text-slate-600 lg:block">
        Credenciales protegidas en el servidor.
        <br />
        Las claves nunca salen del backend.
      </p>
    </aside>
  );
}
