"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { QrViewer } from "@/components/QrViewer";
import { SendMessageForm } from "@/components/SendMessageForm";
import { MediaMessageForm } from "@/components/MediaMessageForm";
import { MessagesPanel, type MessageItem } from "@/components/MessagesPanel";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import {
  ClockIcon,
  InboxIcon,
  LoaderIcon,
  MessageCircleIcon,
  PowerIcon,
  RefreshIcon,
  RestartIcon,
  SendIcon,
  ShieldIcon,
  UploadIcon,
  ZapIcon,
} from "@/components/icons";

const STATUS_POLL_INTERVAL_MS = 15000;
const MESSAGES_POLL_INTERVAL_MS = 10000;

interface InstanceStatus {
  state: string;
  qrcode: string | null;
}

type ActionKind = "restart" | "logout" | "webhook" | null;

function SectionHeader({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-300">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

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
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <MessageCircleIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Panel WhatsApp
            </h1>
            <p className="text-sm text-slate-400">
              Gestión de sesión, envío de mensajes y verificación de entrada
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ConnectionBadge state={status?.state ?? null} loading={loading} />

          <button
            type="button"
            onClick={() => void handleRestart()}
            disabled={action !== null}
            className="btn-base border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-slate-100"
          >
            {action === "restart" ? (
              <LoaderIcon className="h-4 w-4 animate-spin" />
            ) : (
              <RestartIcon className="h-4 w-4" />
            )}
            Reiniciar
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={action !== null}
            className="btn-base border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          >
            <PowerIcon className="h-4 w-4" />
            Cerrar sesión
          </button>

          <button
            type="button"
            onClick={() => void loadStatus()}
            disabled={loading}
            className="btn-base border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-slate-100"
          >
            <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="chip justify-between py-3">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ShieldIcon className="h-4 w-4" />
            Sesión
          </span>
          <ConnectionBadge state={status?.state ?? null} loading={loading} />
        </div>

        <div className="chip justify-between py-3">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <ClockIcon className="h-4 w-4" />
            Última actualización
          </span>
          <span className="font-medium text-slate-200">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
          </span>
        </div>

        <div className="chip justify-between py-3">
          <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <InboxIcon className="h-4 w-4" />
            Mensajes en memoria
          </span>
          <span className="font-medium text-slate-200">{messages.length}</span>
        </div>
      </section>

      {error && (
        <div className="fade-up flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {actionMessage && (
        <div
          className={`fade-up flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            actionMessage.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : actionMessage.kind === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-slate-700 bg-slate-800/50 text-slate-300"
          }`}
        >
          {action === "webhook" && <LoaderIcon className="h-4 w-4 animate-spin" />}
          {actionMessage.text}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel fade-up flex flex-col gap-5 p-6">
          <SectionHeader
            icon={<ShieldIcon className="h-5 w-5" />}
            title="Conexión"
            description="Estado de la instancia y código QR"
          >
            {connected && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                Activa
              </span>
            )}
          </SectionHeader>

          <QrViewer
            qrcode={status?.qrcode ?? null}
            state={status?.state ?? null}
            loading={loading}
          />

          <div className="mt-auto flex flex-col gap-3 border-t border-white/5 pt-4">
            <p className="text-xs text-slate-500">
              Polling automático cada {STATUS_POLL_INTERVAL_MS / 1000} segundos.
            </p>

            <button
              type="button"
              onClick={() => void handleWebhookSetup()}
              disabled={action !== null}
              className="btn-base border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
            >
              {action === "webhook" ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ZapIcon className="h-4 w-4" />
              )}
              Configurar webhook (recepción)
            </button>
          </div>
        </div>

        <div className="glass-panel fade-up flex flex-col gap-5 p-6">
          <SectionHeader
            icon={<SendIcon className="h-5 w-5" />}
            title="Enviar mensaje"
            description="Texto con simulación de presencia"
          />

          <SendMessageForm />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel fade-up flex flex-col gap-5 p-6">
          <SectionHeader
            icon={<UploadIcon className="h-5 w-5" />}
            title="Enviar archivo"
            description="Imágenes, PDF, video, audio, stickers y notas de voz"
          />

          <MediaMessageForm />
        </div>

        <div className="glass-panel fade-up flex flex-col gap-5 p-6">
          <MessagesPanel messages={messages} loading={messagesLoading} />
        </div>
      </section>

      <section className="glass-panel fade-up p-6">
        <ConversationsPanel />
      </section>

      <footer className="pb-4 pt-2 text-center text-xs text-slate-600">
        Proxy seguro · Evolution API v2 · las credenciales nunca salen del servidor
      </footer>
    </main>
  );
}
