"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { QrViewer } from "@/components/QrViewer";
import { SendMessageForm } from "@/components/SendMessageForm";

const POLL_INTERVAL_MS = 15000;

interface InstanceStatus {
  state: string;
  qrcode: string | null;
}

export default function Home() {
  const [status, setStatus] = useState<InstanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp", { cache: "no-store" });
      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
        data?: { state?: string; qrcode?: string | null } | null;
      };

      if (!res.ok || payload.status !== "success" || !payload.data) {
        setError(payload.error ?? "No se pudo obtener el estado de la instancia.");
        return;
      }

      setStatus({
        state: payload.data.state ?? "unknown",
        qrcode: payload.data.qrcode ?? null,
      });
      setLastUpdated(new Date());
    } catch {
      setError("Error de red al consultar el estado de la instancia.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    await loadStatus();
  }

  useEffect(() => {
    const timer = setTimeout(() => void loadStatus(), 0);
    const interval = setInterval(() => void loadStatus(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadStatus]);

  const connected = status?.state.toLowerCase() === "open";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Panel WhatsApp
          </h1>
          <p className="text-sm text-slate-400">
            Estado de la instancia y envío de mensajes
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionBadge state={status?.state ?? null} loading={loading} />
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Actualizar
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid flex-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Conexión</h2>
            {connected && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Activa
              </span>
            )}
          </div>

          <QrViewer qrcode={status?.qrcode ?? null} state={status?.state ?? null} loading={loading} />

          <div className="mt-auto flex flex-col gap-1 text-xs text-slate-500">
            <span>
              Última actualización:{" "}
              {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
            </span>
            <span>Polling automático cada {POLL_INTERVAL_MS / 1000} segundos.</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Enviar mensaje</h2>
            <p className="text-sm text-slate-400">
              Envío de mensajes de texto vía Evolution API.
            </p>
          </div>

          <SendMessageForm />
        </div>
      </section>
    </main>
  );
}
