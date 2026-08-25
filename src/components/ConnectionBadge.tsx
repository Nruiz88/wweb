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

export function ConnectionBadge({ state, loading }: ConnectionBadgeProps) {
  const normalized = state?.toLowerCase() ?? "";
  const isOpen = normalized === "open";

  const label = loading
    ? "Verificando…"
    : STATE_LABELS[normalized] ?? (state ? state : "Desconocido");

  let dotClass = "bg-slate-400";
  let textClass = "text-slate-300";

  if (loading) {
    dotClass = "bg-slate-400 animate-pulse";
  } else if (isOpen) {
    dotClass = "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)]";
    textClass = "text-emerald-300";
  } else {
    dotClass = "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.8)]";
    textClass = "text-red-300";
  }

  return (
    <span className={`chip ${textClass}`}>
      <span className="relative flex h-2.5 w-2.5">
        {!isOpen && !loading && (
          <span className="ping-slow absolute inline-flex h-full w-full rounded-full bg-red-400/70" />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass}`} />
      </span>
      {label}
    </span>
  );
}
