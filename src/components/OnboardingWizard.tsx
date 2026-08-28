"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircleIcon,
  ZapIcon,
  CheckIcon,
  XIcon,
  LoaderIcon,
} from "@/components/icons";

interface OnboardingWizardProps {
  onComplete: () => void;
}

interface WizardStatus {
  whatsappConnected: boolean;
  autoResponses: number;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<WizardStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // Poll status every 4 seconds
  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const instRes = await fetch("/api/instances");
      const instPayload = await instRes.json();
      const connected = instPayload.data?.[0]?.status === "open";
      const instanceId = instPayload.data?.[0]?.id;

      let autoResponses = 0;
      if (instanceId) {
        const arRes = await fetch(`/api/auto-responses?instanceId=${instanceId}`);
        const arPayload = await arRes.json();
        autoResponses = arPayload.status === "success" ? (arPayload.data?.length || 0) : 0;
      }

      setStatus({ whatsappConnected: connected, autoResponses });
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void checkStatus(), 0);
    const interval = setInterval(() => void checkStatus(), 4000);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [checkStatus]);

  // Auto-advance when step is completed
  useEffect(() => {
    if (!status) return;

    const t = setTimeout(() => {
      if (step === 0 && status.whatsappConnected) {
        setStep(1);
      } else if (step === 1 && status.autoResponses > 0) {
        setStep(2);
      }
    }, 0);

    return () => clearTimeout(t);
  }, [status, step]);

  const steps = [
    {
      id: 0,
      title: "Conecta tu WhatsApp",
      description: "Escanea el codigo QR desde tu telefono para conectar tu WhatsApp a tu bot.",
      instructions: [
        "Abre WhatsApp en tu telefono",
        "Ve a Configuracion > Dispositivos vinculados",
        "Toca 'Vincular dispositivo'",
        "Escanea el codigo QR que aparece en pantalla",
      ],
      icon: <MessageCircleIcon className="h-8 w-8" />,
      color: "#00a884",
      href: "/whatsapp",
    },
    {
      id: 1,
      title: "Configura tus respuestas",
      description: "Crea reglas automaticas para que tu bot responda cuando reciba mensajes.",
      instructions: [
        "Elige una plantilla o crea una personalizada",
        "Escribe la palabra clave (ej: horario, precio)",
        "Escribe la respuesta automatica",
        "Activa la regla",
      ],
      icon: <ZapIcon className="h-8 w-8" />,
      color: "#e6a44e",
      href: "/auto-responses",
    },
    {
      id: 2,
      title: "Tu bot esta listo",
      description: "Tu bot esta activo y respondiendo mensajes automaticamente.",
      instructions: [
        "Tu bot responde 24/7",
        "Puedes agregar mas respuestas desde el menu",
        "Puedes pausar o eliminar respuestas",
        "Revisa los logs para ver la actividad",
      ],
      icon: <CheckIcon className="h-8 w-8" />,
      color: "#53bdeb",
      href: "/dashboard",
    },
  ];

  const current = steps[step] || steps[2];

  function handleFinish() {
    // Persist completion to DB
    fetch("/api/onboarding", { method: "PUT" }).catch(() => {});
    onComplete();
  }

  // Step 3: Done screen
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm">
          <div className="overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl">
            <div className="h-1 bg-wa-header">
              <div className="h-full w-full bg-[#53bdeb]" />
            </div>
            <div className="relative border-b border-wa-border bg-wa-header px-6 py-5 text-center">
              <button type="button" onClick={handleFinish} className="absolute right-3 top-3 icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
              <p className="text-xs text-wa-text-secondary/60">Paso 3 de 3</p>
            </div>
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884]/15">
                <CheckIcon className="h-8 w-8 text-[#00a884]" />
              </div>
              <p className="text-lg font-bold text-wa-text">Todo listo</p>
              <p className="mt-2 text-sm text-wa-text-secondary">
                Tu bot esta activo y respondiendo mensajes automaticamente.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={handleFinish}
                className="w-full rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90"
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isStepDone =
    (step === 0 && status?.whatsappConnected) ||
    (step === 1 && (status?.autoResponses || 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl">
          {/* Progress */}
          <div className="h-1 bg-wa-header">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${((step + 1) / 3) * 100}%`, backgroundColor: current.color }}
            />
          </div>

          {/* Header */}
          <div className="relative border-b border-wa-border bg-wa-header px-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-wa-text-secondary/60">Paso {step + 1} de 3</p>
              <button type="button" onClick={handleFinish} className="text-xs text-wa-text-secondary/60 hover:text-wa-text-secondary">
                Saltar
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: `${current.color}15`, color: current.color }}>
              {isStepDone ? <CheckIcon className="h-8 w-8" /> : current.icon}
            </div>

            <p className="text-center text-base font-semibold text-wa-text">
              {isStepDone ? "Paso completado" : current.title}
            </p>
            <p className="mt-2 text-center text-sm text-wa-text-secondary">
              {isStepDone
                ? step === 0
                  ? "WhatsApp conectado. Ahora configura tus respuestas automaticas."
                  : "Respuestas creadas. Tu bot esta listo."
                : current.description}
            </p>

            {!isStepDone && (
              <ol className="mt-5 space-y-3">
                {current.instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ backgroundColor: `${current.color}15`, color: current.color }}>
                      {i + 1}
                    </span>
                    <span className="text-sm text-wa-text-secondary">{inst}</span>
                  </li>
                ))}
              </ol>
            )}

            {isStepDone && checking && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#00a884]">
                <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                Verificando...
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 space-y-2">
            {!isStepDone && (
              <>
                <a
                  href={current.href}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: current.color }}
                >
                  Ir a configurar
                </a>
                <p className="text-center text-[11px] text-wa-text-secondary/50">
                  Al volver, avanzaremos al siguiente paso automaticamente
                </p>
              </>
            )}
            {isStepDone && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: steps[step + 1]?.color || current.color }}
              >
                Siguiente paso
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
