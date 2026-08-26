"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckIcon,
  LoaderIcon,
  SettingsIcon,
} from "@/components/icons";
import OnboardingWizard from "@/components/OnboardingWizard";

interface Status {
  hasInstance: boolean;
  whatsappConnected: boolean;
  autoResponses: number;
  loading: boolean;
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

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Show wizard on first visit if user has instance
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

  // No instance assigned yet
  if (!status.hasInstance) {
    return (
      <div className="flex h-full flex-col bg-wa-panel">
        <div className="border-b border-wa-border bg-wa-header px-4 py-2.5">
          <span className="text-[0.9375rem] font-normal text-wa-text">Inicio</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-wa-header">
              <SettingsIcon className="h-10 w-10 text-wa-text-secondary/30" />
            </div>
            <p className="text-lg font-semibold text-wa-text">Esperando asignacion</p>
            <p className="mt-2 text-sm text-wa-text-secondary">
              Un administrador debe asignarte una instancia de WhatsApp para comenzar
            </p>
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
          <div className="mx-auto max-w-lg space-y-4">
            {/* Status banner */}
            {isRunning ? (
              <div className="rounded-xl border border-[#00a884]/30 bg-[#00a884]/10 p-5 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884]/20">
                  <CheckIcon className="h-6 w-6 text-[#00a884]" />
                </div>
                <p className="text-lg font-bold text-[#00a884]">Tu bot esta activo</p>
                <p className="mt-1 text-sm text-[#00a884]/80">
                  Respondiendo mensajes automaticamente
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-wa-border bg-wa-header p-4 text-center">
                <p className="text-sm font-medium text-wa-text">
                  Sigue estos pasos para activar tu bot
                </p>
              </div>
            )}

            {/* Step 1 */}
            <a
              href="/whatsapp"
              className={`group flex items-center gap-4 rounded-xl border p-4 transition ${
                step1Done
                  ? "border-[#00a884]/30 bg-[#00a884]/5"
                  : "border-wa-border bg-wa-header hover:border-[#00a884]/40 hover:bg-wa-hover"
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step1Done ? "bg-[#00a884]/15 text-[#00a884]" : "bg-[#00a884]/10 text-[#00a884]"
              }`}>
                {step1Done ? <CheckIcon className="h-6 w-6" /> : "1"}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${step1Done ? "text-[#00a884]" : "text-wa-text"}`}>
                  Conecta tu WhatsApp
                </p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">
                  {step1Done ? "WhatsApp conectado y activo" : "Escanea el codigo QR desde tu telefono"}
                </p>
              </div>
              <div className="text-wa-text-secondary/30 group-hover:text-[#00a884]/60">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </a>

            {/* Step 2 */}
            <a
              href="/auto-responses"
              className={`group flex items-center gap-4 rounded-xl border p-4 transition ${
                step2Done
                  ? "border-[#00a884]/30 bg-[#00a884]/5"
                  : step1Done
                  ? "border-wa-border bg-wa-header hover:border-[#e6a44e]/40 hover:bg-wa-hover"
                  : "border-wa-border bg-wa-header opacity-50"
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step2Done
                  ? "bg-[#00a884]/15 text-[#00a884]"
                  : step1Done
                  ? "bg-[#e6a44e]/10 text-[#e6a44e]"
                  : "bg-wa-text-secondary/10 text-wa-text-secondary"
              }`}>
                {step2Done ? <CheckIcon className="h-6 w-6" /> : "2"}
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
              <div className={`text-wa-text-secondary/30 ${step1Done ? "group-hover:text-[#e6a44e]/60" : ""}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </a>

            {/* Step 3 */}
            <div className={`rounded-xl border p-4 ${
              isRunning ? "border-[#00a884]/30 bg-[#00a884]/5" : "border-wa-border bg-wa-header"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
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
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00a884]" />
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
