"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircleIcon,
  LoaderIcon,
  RefreshIcon,
  LogOutIcon,
  CheckIcon,
  XIcon,
} from "@/components/icons";

type ConnectionState = "open" | "close" | "connecting" | "qrcode" | "unknown";

interface InstanceData {
  instanceId: string;
  instanceName: string;
  connectionState: ConnectionState;
  qrCode: string | null;
}

export default function WhatsAppPage() {
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noInstance, setNoInstance] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp");
      const payload = await res.json();

      if (payload.status === "success") {
        setInstance(payload.data);
        setNoInstance(false);
        return payload.data;
      } else if (res.status === 404) {
        setNoInstance(true);
      } else {
        setError(payload.error);
      }
    } catch {
      setError("No se pudo conectar al servidor");
    }
    return null;
  }, []);

  useEffect(() => {
    setLoading(true);
    loadStatus().finally(() => setLoading(false));
  }, [loadStatus]);

  // Poll when connecting
  useEffect(() => {
    if (!connecting) return;
    const interval = setInterval(async () => {
      const data = await loadStatus();
      if (data?.connectionState === "open" || data?.qrCode) {
        clearInterval(interval);
        setConnecting(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [connecting, loadStatus]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp", { method: "POST" });
      const payload = await res.json();
      if (payload.status !== "success") {
        setError(payload.error);
        setConnecting(false);
      } else {
        await loadStatus();
      }
    } catch {
      setError("No se pudo conectar");
      setConnecting(false);
    }
  }

  async function handleLogout() {
    if (!confirm("Tu WhatsApp se desconectara. Puedes volver a conectarlo despues.")) return;
    try {
      await fetch("/api/whatsapp", { method: "DELETE" });
      await loadStatus();
    } catch {
      setError("Error al desconectar");
    }
  }

  const isConnected = instance?.connectionState === "open";

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="border-b border-wa-border bg-wa-header px-4 py-2.5">
        <span className="text-[0.9375rem] font-normal text-wa-text">Mi WhatsApp</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : noInstance ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-wa-header">
              <MessageCircleIcon className="h-10 w-10 text-wa-text-secondary/30" />
            </div>
            <div>
              <p className="text-lg font-semibold text-wa-text">Sin instancia asignada</p>
              <p className="mt-2 max-w-xs text-sm text-wa-text-secondary">
                El administrador debe asignarte una instancia de WhatsApp para poder conectar
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-sm space-y-6">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <XIcon className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto">
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Connected */}
            {isConnected ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#00a884]/30 bg-[#00a884]/5 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884]/15">
                    <CheckIcon className="h-7 w-7 text-[#00a884]" />
                  </div>
                  <p className="text-lg font-semibold text-wa-text">Conectado</p>
                  <p className="mt-1 text-sm text-wa-text-secondary">
                    {instance?.instanceName}
                  </p>
                  <p className="mt-2 text-xs text-[#00a884]">
                    Tu WhatsApp esta activo y recibiendo mensajes
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-wa-border px-4 py-2.5 text-sm text-wa-text-secondary transition hover:bg-wa-hover"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Verificar estado
                </button>

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400 transition hover:bg-red-500/20"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Desconectar
                </button>
              </div>

            /* QR Code */
            ) : instance?.qrCode ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-wa-border bg-wa-header p-6 text-center">
                  <p className="mb-1 text-base font-semibold text-wa-text">
                    Escanea el codigo QR
                  </p>
                  <p className="mb-5 text-xs text-wa-text-secondary">
                    Abre WhatsApp en tu telefono, ve a{" "}
                    <span className="font-medium text-wa-text">Configuracion</span> &gt;{" "}
                    <span className="font-medium text-wa-text">Dispositivos vinculados</span> &gt;{" "}
                    <span className="font-medium text-wa-text">Vincular dispositivo</span>
                  </p>

                  <div className="mx-auto w-56 rounded-lg bg-white p-2">
                    <img
                      src={instance.qrCode}
                      alt="Codigo QR para conectar WhatsApp"
                      className="h-auto w-full"
                    />
                  </div>

                  {connecting && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#00a884]">
                      <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                      Esperando conexion...
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-wa-border px-4 py-2.5 text-sm text-wa-text-secondary transition hover:bg-wa-hover"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Actualizar codigo
                </button>
              </div>

            /* Disconnected - Ready to connect */
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-wa-border bg-wa-header p-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-wa-text-secondary/10">
                    <MessageCircleIcon className="h-7 w-7 text-wa-text-secondary/40" />
                  </div>
                  <p className="text-base font-semibold text-wa-text">
                    Conecta tu WhatsApp
                  </p>
                  <p className="mt-1 text-sm text-wa-text-secondary">
                    {instance?.instanceName}
                  </p>
                  <p className="mt-2 text-xs text-wa-text-secondary/60">
                    Necesitas tu telefono para escanear el codigo QR
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00a884] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {connecting ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshIcon className="h-4 w-4" />
                  )}
                  {connecting ? "Conectando..." : "Conectar"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
