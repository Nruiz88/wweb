"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { QrViewer } from "@/components/QrViewer";
import { SendMessageForm } from "@/components/SendMessageForm";
import { MediaMessageForm } from "@/components/MediaMessageForm";
import { MessagesPanel, type MessageItem } from "@/components/MessagesPanel";

const STATUS_POLL_INTERVAL_MS = 15000;
const MESSAGES_POLL_INTERVAL_MS = 10000;

interface InstanceStatus {
  state: string;
  qrcode: string | null;
}

type ActionKind = "restart" | "logout" | "webhook" | null;

export default function Home() {
  const [status, setStatus] = useState<InstanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  const [action, setAction] = useState<ActionKind>(null);
  const [actionMessage, setActionMessage] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

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

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/messages", { cache: "no-store" });
      const payload = (await res.json()) as {
        status?: string;
        data?: { messages?: MessageItem[] } | null;
      };

      if (res.ok && payload.status === "success" && payload.data) {
        setMessages(payload.data.messages ?? []);
      }
    } catch {
      // El polling de mensajes no debe interrumpir la vista si falla.
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const statusTimer = setTimeout(() => void loadStatus(), 0);
    const messagesTimer = setTimeout(() => void loadMessages(), 0);
    const statusInterval = setInterval(
      () => void loadStatus(),
      STATUS_POLL_INTERVAL_MS
    );
    const messagesInterval = setInterval(
      () => void loadMessages(),
      MESSAGES_POLL_INTERVAL_MS
    );

    return () => {
      clearTimeout(statusTimer);
      clearTimeout(messagesTimer);
      clearInterval(statusInterval);
      clearInterval(messagesInterval);
    };
  }, [loadStatus, loadMessages]);

  async function handleRestart() {
    setAction("restart");
    setActionMessage({ kind: "info", text: "Reiniciando instancia…" });

    try {
      const res = await fetch("/api/whatsapp/restart", { method: "POST" });
      const payload = (await res.json()) as { status?: string; error?: string | null };

      if (!res.ok || payload.status !== "success") {
        setActionMessage({ kind: "error", text: payload.error ?? "No se pudo reiniciar la instancia." });
        return;
      }

      setActionMessage({ kind: "success", text: "Instancia reiniciada correctamente." });
      await loadStatus();
    } catch {
      setActionMessage({ kind: "error", text: "Error de red al reiniciar la instancia." });
    } finally {
      setAction(null);
    }
  }

  async function handleLogout() {
    if (!window.confirm("¿Cerrar sesión de WhatsApp? Deberás escanear el QR para reconectar.")) {
      return;
    }

    setAction("logout");
    setActionMessage({ kind: "info", text: "Cerrando sesión…" });

    try {
      const res = await fetch("/api/whatsapp/logout", { method: "POST" });
      const payload = (await res.json()) as { status?: string; error?: string | null };

      if (!res.ok || payload.status !== "success") {
        setActionMessage({ kind: "error", text: payload.error ?? "No se pudo cerrar la sesión." });
        return;
      }

      setActionMessage({ kind: "success", text: "Sesión cerrada. Escanea el QR para reconectar." });
      await loadStatus();
    } catch {
      setActionMessage({ kind: "error", text: "Error de red al cerrar la sesión." });
    } finally {
      setAction(null);
    }
  }

  async function handleWebhookSetup() {
    setAction("webhook");
    setActionMessage({ kind: "info", text: "Configurando webhook en Evolution API…" });

    try {
      const res = await fetch("/api/whatsapp/webhook/setup", { method: "POST" });
      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
        data?: { url?: string } | null;
      };

      if (!res.ok || payload.status !== "success") {
        setActionMessage({ kind: "error", text: payload.error ?? "No se pudo configurar el webhook." });
        return;
      }

      setActionMessage({
        kind: "success",
        text: `Webhook configurado en ${payload.data?.url ?? "la URL pública"}.`,
      });
    } catch {
      setActionMessage({ kind: "error", text: "Error de red al configurar el webhook." });
    } finally {
      setAction(null);
    }
  }

  const connected = status?.state.toLowerCase() === "open";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Panel WhatsApp
          </h1>
          <p className="text-sm text-slate-400">
            Gestión de sesión, envío de mensajes y verificación de entrada
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge state={status?.state ?? null} loading={loading} />

          <button
            type="button"
            onClick={() => void handleRestart()}
            disabled={action !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === "restart" && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-100"
                aria-hidden
              />
            )}
            Reiniciar
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={action !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar sesión
          </button>

          <button
            type="button"
            onClick={() => void loadStatus()}
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

      {actionMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            actionMessage.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : actionMessage.kind === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-slate-700 bg-slate-800/50 text-slate-300"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Conexión</h2>
            {connected && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Activa
              </span>
            )}
          </div>

          <QrViewer
            qrcode={status?.qrcode ?? null}
            state={status?.state ?? null}
            loading={loading}
          />

          <div className="mt-auto flex flex-col gap-3 border-t border-slate-800 pt-4">
            <div className="flex flex-col gap-1 text-xs text-slate-500">
              <span>
                Última actualización:{" "}
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
              </span>
              <span>
                Polling automático cada {STATUS_POLL_INTERVAL_MS / 1000} segundos.
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleWebhookSetup()}
              disabled={action !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {action === "webhook" && (
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-100"
                  aria-hidden
                />
              )}
              Configurar webhook (recepción)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Enviar mensaje</h2>
            <p className="text-sm text-slate-400">
              Texto con opción de simular presencia antes del envío.
            </p>
          </div>

          <SendMessageForm />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Enviar archivo</h2>
            <p className="text-sm text-slate-400">
              Imágenes, documentos/PDF, video, audio y notas de voz (PTT).
            </p>
          </div>

          <MediaMessageForm />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <MessagesPanel messages={messages} loading={messagesLoading} />
        </div>
      </section>
    </main>
  );
}
