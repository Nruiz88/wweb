"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircleIcon,
  LoaderIcon,
  RefreshIcon,
  LogOutIcon,
  CheckIcon,
  XIcon,
  ArrowRightIcon,
} from "@/components/icons";

type ConnectionState = "open" | "close" | "connecting" | "qrcode" | "unknown";

interface InstanceData {
  instanceId: string;
  instanceName: string;
  connectionState: ConnectionState;
  qrCode: string | null;
}

// Connected illustration
function ConnectedIllustration() {
  return (
    <div className="relative">
      <div className="absolute inset-0 animate-pulse rounded-full bg-[#00a884]/20 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5 ring-4 ring-[#00a884]/10">
        <CheckIcon className="h-12 w-12 text-[#00a884]" />
      </div>
      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#00a884] shadow-lg shadow-[#00a884]/30">
        <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </div>
    </div>
  );
}

// Disconnected illustration
function DisconnectedIllustration() {
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-wa-header to-wa-panel ring-4 ring-wa-border/30">
      <MessageCircleIcon className="h-12 w-12 text-wa-text-secondary/20" />
    </div>
  );
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
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-normal text-wa-text">Mi WhatsApp</span>
          {isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#00a884]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00a884]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00a884]" />
              Conectado
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-start justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : noInstance ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <DisconnectedIllustration />
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
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                <XIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="shrink-0">
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Connected */}
            {isConnected ? (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-[#00a884]/20 bg-gradient-to-br from-[#00a884]/10 to-[#00a884]/5 p-8 text-center">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#00a884]/5 blur-2xl" />
                  <div className="relative">
                    <ConnectedIllustration />
                    <p className="mt-4 text-xl font-bold text-wa-text">Conectado</p>
                    <p className="mt-1 text-sm text-wa-text-secondary">{instance?.instanceName}</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#00a884]/15 px-3 py-1">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                      </span>
                      <span className="text-xs font-medium text-[#00a884]">En linea</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-sm text-wa-text-secondary transition-all hover:bg-wa-hover hover:text-wa-text"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Verificar estado
                </button>

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400 transition-all hover:bg-red-500/10"
                >
                  <LogOutIcon className="h-4 w-4" />
                  Desconectar
                </button>
              </div>

            /* QR Code */
            ) : instance?.qrCode ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-wa-border bg-wa-header p-6 text-center">
                  <p className="mb-1 text-base font-semibold text-wa-text">
                    Escanea el codigo QR
                  </p>
                  <p className="mb-5 text-xs text-wa-text-secondary">
                    Abre WhatsApp en tu telefono, ve a{" "}
                    <span className="font-medium text-wa-text">Configuracion</span> &gt;{" "}
                    <span className="font-medium text-wa-text">Dispositivos vinculados</span> &gt;{" "}
                    <span className="font-medium text-wa-text">Vincular dispositivo</span>
                  </p>

                  <div className="mx-auto w-56 overflow-hidden rounded-xl bg-white p-2 shadow-lg shadow-black/20">
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-sm text-wa-text-secondary transition-all hover:bg-wa-hover hover:text-wa-text"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Actualizar codigo
                </button>
              </div>

            /* Disconnected */
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-8 text-center">
                  <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-wa-text-secondary/5 blur-2xl" />
                  <div className="relative">
                    <DisconnectedIllustration />
                    <p className="mt-4 text-lg font-semibold text-wa-text">Conecta tu WhatsApp</p>
                    <p className="mt-1 text-sm text-wa-text-secondary">{instance?.instanceName}</p>
                    <p className="mt-2 text-xs text-wa-text-secondary/50">
                      Necesitas tu telefono para escanear el codigo QR
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:shadow-xl hover:shadow-[#00a884]/35 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {connecting ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                      </svg>
                    </>
                  )}
                  {connecting ? "Conectando..." : "Conectar WhatsApp"}
                  {!connecting && <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
