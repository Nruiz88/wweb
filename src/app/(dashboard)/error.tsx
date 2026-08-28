"use client";

import { LogOutIcon } from "@/components/icons";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#111b21] px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute -inset-6 rounded-full bg-red-500/10 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 ring-4 ring-red-500/10">
          <span className="text-3xl">⚠️</span>
        </div>
      </div>

      <h2 className="text-lg font-bold text-white">Algo salió mal</h2>
      <p className="mt-1 max-w-xs text-sm text-gray-400">
        {error.message?.includes("hydrat") || error.message?.includes("Hydrat")
          ? "Error de hidratación. Recargá la página."
          : "Ocurrió un error inesperado en esta sección."}
      </p>

      {error.digest && (
        <p className="mt-3 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[10px] text-gray-500">
          {error.digest}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-[#00a884] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:bg-[#00a884]/90"
        >
          Reintentar
        </button>
        <a
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
