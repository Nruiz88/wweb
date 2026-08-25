"use client";

interface ConnectionBadgeProps {
  state: string | null;
  loading?: boolean;
}

const STATE_LABELS: Record<string, string> = {
  open: "Conectado",
  close: "Desconectado",
  connecting: "Conectando…",
  qrcode: "QR pendiente",
};

const STATE_STYLES: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  close: "bg-red-500/15 text-red-300 ring-red-500/40",
  connecting: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  qrcode: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
};

export function ConnectionBadge({ state, loading }: ConnectionBadgeProps) {
  const normalized = state?.toLowerCase() ?? "";

  const label = loading
    ? "Verificando…"
    : STATE_LABELS[normalized] ?? (state ? state : "Desconocido");

  const styles = loading
    ? "bg-slate-500/15 text-slate-300 ring-slate-500/40"
    : STATE_STYLES[normalized] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/40";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${styles}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          loading
            ? "animate-pulse bg-slate-400"
            : normalized === "open"
              ? "bg-emerald-400"
              : "bg-red-400"
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}
