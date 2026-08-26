"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckIcon,
  LoaderIcon,
  MessageCircleIcon,
  ZapIcon,
  SettingsIcon,
  ArrowRightIcon,
} from "@/components/icons";
import OnboardingWizard from "@/components/OnboardingWizard";

interface Status {
  hasInstance: boolean;
  whatsappConnected: boolean;
  autoResponses: number;
  loading: boolean;
}

// Mini illustration: WhatsApp connected
function ConnectedBadge() {
  return (
    <div className="relative">
      <div className="absolute inset-0 animate-pulse rounded-full bg-[#00a884]/20 blur-xl" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5 ring-4 ring-[#00a884]/10">
        <CheckIcon className="h-10 w-10 text-[#00a884]" />
      </div>
    </div>
  );
}

// Mini illustration: Waiting
function WaitingBadge() {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-wa-header to-wa-panel ring-4 ring-wa-border/30">
      <SettingsIcon className="h-10 w-10 text-wa-text-secondary/30" />
    </div>
  );
}

export default function DashboardPage() {
  const [status, setStatus] = useState<Status>({
    hasInstance: false,
    whatsappConnected: false,
    autoResponses: 0,
    loading: true,
  });
  const [showWizard, setShowWizard] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const instRes = await fetch("/api/instances");
      const instPayload = await instRes.json();

      const hasInstance = instPayload.status === "success" && instPayload.data?.length > 0;
      const whatsappConnected = instPayload.data?.[0]?.status === "open";
      const instanceId = hasInstance ? instPayload.data[0].id : null;

      let autoResponses = 0;
      if (instanceId) {
        const arRes = await fetch(`/api/auto-responses?instanceId=${instanceId}`);
        const arPayload = await arRes.json();
        if (arPayload.status === "success") {
          autoResponses = arPayload.data?.length || 0;
        }
      }

      setStatus({ hasInstance, whatsappConnected, autoResponses, loading: false });
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const done = localStorage.getItem("onboarding_done");
    if (!done && status.hasInstance && !status.loading) {
      setShowWizard(true);
    }
  }, [status.hasInstance, status.loading]);

  function handleWizardComplete() {
    localStorage.setItem("onboarding_done", "1");
    setShowWizard(false);
    void loadStatus();
  }

  const isRunning = status.whatsappConnected && status.autoResponses > 0;
  const step1Done = status.whatsappConnected;
  const step2Done = status.autoResponses > 0;

  if (status.loading) {
    return (
      <div className="flex h-full items-center justify-center bg-wa-panel">
        <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
      </div>
    );
  }

  if (!status.hasInstance) {
    return (
      <div className="flex h-full flex-col bg-wa-panel">
        <div className="border-b border-wa-border bg-wa-header px-4 py-2.5">
          <span className="text-[0.9375rem] font-normal text-wa-text">Inicio</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto max-w-sm text-center">
            <WaitingBadge />
            <p className="mt-6 text-lg font-semibold text-wa-text">Esperando asignacion</p>
            <p className="mt-2 text-sm text-wa-text-secondary">
              Un administrador debe asignarte una instancia de WhatsApp para comenzar
            </p>
            <div className="mt-6 rounded-xl border border-wa-border bg-wa-header p-4">
              <p className="text-xs text-wa-text-secondary/60">
                Mientras tanto, podes completar tu <a href="/profile" className="text-[#00a884] hover:underline">perfil</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} />}
      <div className="flex h-full flex-col bg-wa-panel">
        <div className="border-b border-wa-border bg-wa-header px-4 py-2.5">
          <span className="text-[0.9375rem] font-normal text-wa-text">Inicio</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-lg space-y-5">

            {/* Status banner */}
            {isRunning ? (
              <div className="relative overflow-hidden rounded-2xl border border-[#00a884]/20 bg-gradient-to-br from-[#00a884]/10 to-[#00a884]/5 p-6 text-center">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#00a884]/5 blur-2xl" />
                <div className="relative">
                  <ConnectedBadge />
                  <p className="mt-4 text-xl font-bold text-[#00a884]">Tu bot esta activo</p>
                  <p className="mt-1 text-sm text-[#00a884]/70">
                    Respondiendo mensajes automaticamente
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#00a884]/15 px-3 py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                    </span>
                    <span className="text-xs font-medium text-[#00a884]">En linea</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-wa-border bg-wa-header p-5 text-center">
                <p className="text-sm font-medium text-wa-text">
                  Sigue estos pasos para activar tu bot
                </p>
              </div>
            )}

            {/* Progress bar */}
            <div className="rounded-xl border border-wa-border bg-wa-header p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-wa-text-secondary">Progreso</p>
                <p className="text-xs font-semibold text-wa-text">
                  {step1Done && step2Done ? "2/2" : step1Done || step2Done ? "1/2" : "0/2"}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-wa-panel">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00a884] to-[#25d366] transition-all duration-500"
                  style={{ width: `${step1Done && step2Done ? 100 : step1Done || step2Done ? 50 : 0}%` }}
                />
              </div>
            </div>

            {/* Step 1 */}
            <a
              href="/whatsapp"
              className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all ${
                step1Done
                  ? "border-[#00a884]/20 bg-gradient-to-r from-[#00a884]/5 to-transparent"
                  : "border-wa-border bg-wa-header hover:border-[#00a884]/30 hover:shadow-lg hover:shadow-[#00a884]/5"
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                step1Done ? "bg-[#00a884]/15 text-[#00a884]" : "bg-[#00a884]/10 text-[#00a884]"
              }`}>
                {step1Done ? <CheckIcon className="h-6 w-6" /> : <MessageCircleIcon className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${step1Done ? "text-[#00a884]" : "text-wa-text"}`}>
                  Conecta tu WhatsApp
                </p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">
                  {step1Done ? "WhatsApp conectado y activo" : "Escanea el codigo QR desde tu telefono"}
                </p>
              </div>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-wa-text-secondary/30 transition group-hover:text-[#00a884]/60 group-hover:translate-x-1" />
            </a>

            {/* Step 2 */}
            <a
              href="/auto-responses"
              className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all ${
                step2Done
                  ? "border-[#00a884]/20 bg-gradient-to-r from-[#00a884]/5 to-transparent"
                  : step1Done
                  ? "border-wa-border bg-wa-header hover:border-[#e6a44e]/30 hover:shadow-lg hover:shadow-[#e6a44e]/5"
                  : "border-wa-border bg-wa-header opacity-50 cursor-not-allowed"
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                step2Done
                  ? "bg-[#00a884]/15 text-[#00a884]"
                  : step1Done
                  ? "bg-[#e6a44e]/10 text-[#e6a44e]"
                  : "bg-wa-text-secondary/10 text-wa-text-secondary"
              }`}>
                {step2Done ? <CheckIcon className="h-6 w-6" /> : <ZapIcon className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${
                  step2Done ? "text-[#00a884]" : step1Done ? "text-wa-text" : "text-wa-text-secondary"
                }`}>
                  Crea tus respuestas
                </p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">
                  {step2Done
                    ? `${status.autoResponses} respuesta${status.autoResponses > 1 ? "s" : ""} activa${status.autoResponses > 1 ? "s" : ""}`
                    : step1Done
                    ? "Define que responder cuando llegue un mensaje"
                    : "Primero conecta tu WhatsApp"}
                </p>
              </div>
              <ArrowRightIcon className={`h-4 w-4 shrink-0 transition ${step1Done ? "text-wa-text-secondary/30 group-hover:text-[#e6a44e]/60 group-hover:translate-x-1" : "text-wa-text-secondary/20"}`} />
            </a>

            {/* Step 3 */}
            <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
              isRunning
                ? "border-[#00a884]/20 bg-gradient-to-r from-[#00a884]/5 to-transparent"
                : "border-wa-border bg-wa-header"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  isRunning ? "bg-[#00a884]/15 text-[#00a884]" : "bg-[#53bdeb]/10 text-[#53bdeb]"
                }`}>
                  {isRunning ? <CheckIcon className="h-6 w-6" /> : "3"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isRunning ? "text-[#00a884]" : "text-wa-text"}`}>
                    Tu bot esta activo
                  </p>
                  <p className="mt-0.5 text-xs text-wa-text-secondary">
                    {isRunning
                      ? "Recibiendo y respondiendo mensajes 24/7"
                      : "Completa los pasos anteriores para activar tu bot"}
                  </p>
                </div>
                {isRunning && (
                  <div className="flex items-center gap-1.5 rounded-full bg-[#00a884]/10 px-3 py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                    </span>
                    <span className="text-xs font-medium text-[#00a884]">Activo</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[11px] text-wa-text-secondary/40">
              Necesitas ayuda? Contacta al administrador
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
