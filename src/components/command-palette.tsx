"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Home, MessageCircle, Zap, Calendar, Clock, User, Shield, Settings, Search } from "lucide-react";

const ITEMS = [
  { label: "Inicio", href: "/dashboard", icon: Home },
  { label: "Mi WhatsApp", href: "/whatsapp", icon: MessageCircle },
  { label: "Auto-Respuestas", href: "/auto-responses", icon: Zap },
  { label: "Menús interactivos", href: "/menus", icon: Zap },
  { label: "Ver turnos", href: "/calendar", icon: Calendar },
  { label: "Configurar horarios", href: "/calendar?config=1", icon: Calendar },
  { label: "Actividad", href: "/logs", icon: Clock },
  { label: "Mi Perfil", href: "/profile", icon: User },
  { label: "Admin", href: "/admin", icon: Shield },
  { label: "Configuración", href: "/settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="hidden lg:flex items-center gap-2 rounded-xl border border-border bg-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
      <Search className="h-3.5 w-3.5" /> Buscar… <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘K</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <Command className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Command.Input autoFocus placeholder="Buscar página..." className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" />
        </div>
        <Command.List className="max-h-72 overflow-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">Sin resultados</Command.Empty>
          <Command.Group heading="Navegación" className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
            {ITEMS.map((it) => {
              const Icon = it.icon;
              return (
                <Command.Item key={it.href} onSelect={() => { setOpen(false); router.push(it.href); }} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer aria-selected:bg-accent">
                  <Icon className="h-4 w-4" /> {it.label}
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">↑↓ navegar · ↵ ir · esc cerrar</div>
      </Command>
    </div>
  );
}
