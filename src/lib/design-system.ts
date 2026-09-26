/**
 * Design System — Visual tokens, animations y componentes de UI
 * Aplicado a: Catalog, Auto-Responses, Menus
 */

export const colors = {
  surface: {
    base: "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950",
    card: "bg-white/[0.03] backdrop-blur-md border border-white/[0.06]",
    cardHover: "hover:border-white/[0.10] hover:bg-white/[0.05]",
  },
  text: {
    primary: "text-slate-100",
    secondary: "text-slate-400",
    muted: "text-slate-500",
  },
  accent: {
    primary: "text-cyan-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-rose-400",
  },
  button: {
    primary: "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(6,182,212,0.25)]",
    ghost: "bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]",
  },
  tag: {
    active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
    inactive: "bg-rose-400/10 text-rose-400 border-rose-400/20",
    neutral: "bg-slate-400/10 text-slate-400 border-slate-400/20",
  },
};

export const typography = {
  h1: "text-2xl sm:text-3xl font-extrabold tracking-tight",
  h2: "text-xl font-bold tracking-tight",
  label: "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400",
  body: "text-sm text-slate-300",
};

export const layout = {
  card: "rounded-3xl shadow-2xl shadow-black/60 overflow-hidden",
  section: "rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] backdrop-blur-md",
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
};
