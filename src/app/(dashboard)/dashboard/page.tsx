"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  MessageCircle,
  Zap,
  Settings,
  ArrowRight,
  Smartphone,
  Bot,
  Sparkles,
  HelpCircle,
  ChevronDown,
  CalendarDays,
  BarChart3,
  User,
  Menu,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useUserPlan } from "@/hooks/useUserPlan";
import OnboardingWizard from "@/components/OnboardingWizard";

interface Status {
  hasInstance: boolean;
  whatsappConnected: boolean;
  autoResponses: number;
  loading: boolean;
}

function ConnectedBadge() {
  return (
    <div className="relative mx-auto">
      <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-primary/10">
        <Check className="h-10 w-10 text-primary" />
      </div>
    </div>
  );
}

function WaitingBadge() {
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-muted to-card ring-4 ring-border/30">
      <Settings className="h-10 w-10 text-muted-foreground/30" />
    </div>
  );
}

async function fetchInstances() {
  // lite=1: estado desde DB (fresco si checked_at < 60s por el Fix 2), sin
  // llamar a Evolution en cada visita al dashboard.
  const res = await fetch("/api/instances?lite=1");
  const payload = await res.json();
  const hasInstance = payload.status === "success" && payload.data?.length > 0;
  const whatsappConnected = payload.data?.[0]?.status === "open";
  const instanceId = hasInstance ? payload.data[0].id : null;
  return { hasInstance, whatsappConnected, instanceId };
}

async function fetchAutoResponses(instanceId: string) {
  const res = await fetch(`/api/auto-responses?instanceId=${instanceId}`);
  const payload = await res.json();
  return payload.status === "success" ? payload.data?.length || 0 : 0;
}

async function fetchOnboarding() {
  try {
    const res = await fetch("/api/onboarding");
    const payload = await res.json();
    return payload.status === "success" && !payload.data.completed;
  } catch {
    return false;
  }
}

export default function DashboardPage() {
  const [status, setStatus] = useState<Status>({
    hasInstance: false,
    whatsappConnected: false,
    autoResponses: 0,
    loading: true,
  });
  const [showWizard, setShowWizard] = useState(false);
  const { plan, isAdmin: isAdminPlan, loading: planLoading } = useUserPlan();
  const effectiveIsPro = plan === "pro" || isAdminPlan;
  const [guideOpen, setGuideOpen] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("boti_guide_collapsed") !== "1" : true
  );
  const toggleGuide = () => {
    setGuideOpen((v) => {
      const nv = !v;
      if (typeof window !== "undefined") localStorage.setItem("boti_guide_collapsed", nv ? "0" : "1");
      return nv;
    });
  };

  const loadStatus = useCallback(async () => {
    try {
      const [instInfo, needsOnboarding] = await Promise.all([fetchInstances(), fetchOnboarding()]);
      let autoResponses = 0;
      if (instInfo.instanceId) {
        autoResponses = await fetchAutoResponses(instInfo.instanceId);
      }
      setStatus({ ...instInfo, autoResponses, loading: false });
      if (instInfo.hasInstance && needsOnboarding) setShowWizard(true);
    } catch {
      setStatus((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadStatus(), 0);
    return () => clearTimeout(t);
  }, [loadStatus]);

  function handleWizardComplete() {
    setShowWizard(false);
    void loadStatus();
  }

  const isRunning = status.whatsappConnected && status.autoResponses > 0;
  const step1Done = status.whatsappConnected;
  const step2Done = status.autoResponses > 0;
  const progressPct = step1Done && step2Done ? 100 : step1Done || step2Done ? 50 : 0;
  const progressLabel = step1Done && step2Done ? "2/2" : step1Done || step2Done ? "1/2" : "0/2";

  if (status.loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border bg-card px-4 py-2.5">
          <span className="text-[0.9375rem] font-medium text-foreground">Inicio</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-lg space-y-4">
            <Card className="p-6">
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!status.hasInstance) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border bg-card px-4 py-2.5">
          <span className="text-[0.9375rem] font-medium text-foreground">Inicio</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto w-full max-w-sm text-center"
          >
            <div className="flex justify-center">
              <WaitingBadge />
            </div>
            <p className="mt-6 text-lg font-semibold text-foreground">Esperando asignación</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Un administrador debe asignarte una instancia de WhatsApp para comenzar
            </p>
            <Card className="mt-6">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  Mientras tanto, podés completar tu{" "}
                  <Link href="/profile" prefetch={false} className="font-medium text-primary hover:underline">
                    perfil
                  </Link>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} />}
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border bg-card px-4 py-2.5">
          <span className="text-[0.9375rem] font-medium text-foreground">Inicio</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[1.4fr_0.9fr] items-start">
            <div className="space-y-5">
              {/* Status banner */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              {isRunning ? (
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/[0.06] to-transparent text-center">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                  <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-primary/5 blur-xl" />
                  <CardContent className="relative p-6 pt-6">
                    <ConnectedBadge />
                    <p className="mt-4 flex items-center justify-center gap-2 text-xl font-bold text-primary">
                      <Sparkles className="h-5 w-5" />
                      Tu bot está activo
                    </p>
                    <p className="mt-1 text-sm text-primary/70">Respondiendo mensajes automáticamente</p>
                    <div className="mt-4 flex justify-center">
                      <Badge className="gap-1.5 bg-primary/15 px-3 py-1 text-primary hover:bg-primary/15">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        En línea
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-5 text-center">
                    <p className="text-sm font-medium text-foreground">Sigue estos pasos para activar tu bot</p>
                    <p className="mt-1 text-xs text-muted-foreground">Completa la configuración en menos de 2 minutos</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* Progress bar */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Progreso</p>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {progressLabel}
                    </Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-[#25d366]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.16 }}
            >
              <Card
                className={
                  step1Done
                    ? "border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
                    : "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
                }
              >
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      step1Done ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {step1Done ? <Check className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className={`text-sm ${step1Done ? "text-primary" : "text-foreground"}`}>
                      Conecta tu WhatsApp
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {step1Done ? "WhatsApp conectado y activo" : "Escaneá el código QR desde tu teléfono"}
                    </CardDescription>
                  </div>
                  <Badge variant={step1Done ? "default" : "outline"} className="shrink-0">
                    {step1Done ? "Listo" : "Pendiente"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 pt-0">
                  <p className="text-xs text-muted-foreground">
                    {step1Done ? "Tu número está vinculado correctamente." : "Paso 1 de 2 — vinculá tu número"}
                  </p>
                  <Link
                    href="/whatsapp"
                    prefetch={false}
                    className={buttonVariants({ size: "sm", variant: step1Done ? "secondary" : "default" })}
                  >
                    {step1Done ? "Ver estado" : "Conectar"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.24 }}
            >
              <Card
                className={
                  step2Done
                    ? "border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
                    : step1Done
                      ? "hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all"
                      : "opacity-60"
                }
              >
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      step2Done
                        ? "bg-primary/15 text-primary"
                        : step1Done
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step2Done ? <Check className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle
                      className={`text-sm ${step2Done ? "text-primary" : step1Done ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Crea tus respuestas
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {step2Done
                        ? `${status.autoResponses} respuesta${status.autoResponses > 1 ? "s" : ""} activa${status.autoResponses > 1 ? "s" : ""}`
                        : step1Done
                          ? "Definí qué responder cuando llegue un mensaje"
                          : "Primero conectá tu WhatsApp"}
                    </CardDescription>
                  </div>
                  <Badge variant={step2Done ? "default" : "outline"} className="shrink-0">
                    {step2Done ? "Listo" : step1Done ? "Siguiente" : "Bloqueado"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3 pt-0">
                  <p className="text-xs text-muted-foreground">
                    {step2Done ? "Tus auto-respuestas están funcionando." : "Paso 2 de 2 — configurá el bot"}
                  </p>
                  <Link
                    href="/auto-responses"
                    prefetch={false}
                    aria-disabled={!step1Done && !step2Done}
                    className={
                      buttonVariants({ size: "sm", variant: step2Done ? "secondary" : step1Done ? "default" : "outline" }) +
                      (!step1Done && !step2Done ? " pointer-events-none opacity-50" : "")
                    }
                  >
                    {step2Done ? "Gestionar" : "Crear"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.32 }}
            >
              <Card
                className={
                  isRunning
                    ? "border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
                    : "border-dashed"
                }
              >
                <CardHeader className="flex-row items-center gap-4 space-y-0 pb-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      isRunning ? "bg-primary/15 text-primary" : "bg-sky-500/10 text-sky-600"
                    }`}
                  >
                    {isRunning ? <Check className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className={`text-sm ${isRunning ? "text-primary" : "text-foreground"}`}>
                      Tu bot está activo
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {isRunning ? "Recibiendo y respondiendo mensajes 24/7" : "Completá los pasos anteriores para activar tu bot"}
                    </CardDescription>
                  </div>
                  {isRunning ? (
                    <Badge className="gap-1.5 bg-primary/15 text-primary hover:bg-primary/15">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                      </span>
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline">En espera</Badge>
                  )}
                </CardHeader>
                {!isRunning && (
                  <>
                    <Separator />
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5" />
                        Se activará automáticamente al completar los pasos 1 y 2
                      </div>
                    </CardContent>
                  </>
                )}
                {isRunning && (
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Todo listo — tu bot responde sin intervención
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>

            <p className="text-center text-[11px] text-muted-foreground/60">¿Necesitás ayuda? Contactá al administrador</p>
            </div>
            <div className="space-y-5 lg:sticky lg:top-6">
{/* Guía rápida — explica panel usuario / usuario Pro (no admin), visible también para admin */}
            {!planLoading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.12 }}>
                <Card className="overflow-hidden border-primary/15">
                  <button type="button" onClick={toggleGuide} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Guía rápida — qué hace cada parte</p>
                      <p className="text-xs text-muted-foreground">
                        {effectiveIsPro ? "Tu plan Pro incluye todo + Calendario" : "Plan Starter — Calendario es Pro (podés upgradear)"}
                      </p>
                    </div>
                    <Badge variant="secondary" className="hidden sm:inline-flex text-[10px]">{effectiveIsPro ? "Pro" : "Starter"}</Badge>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`} />
                  </button>
                  {guideOpen && (
                    <div className="border-t border-border">
                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><MessageCircle className="h-3.5 w-3.5 text-primary" /> Mi WhatsApp <Badge variant="outline" className="ml-auto text-[9px]">Importante</Badge></div>
                          <p className="mt-1 text-xs text-muted-foreground">Vinculá tu número escaneando el QR. Sin esto, el bot no puede responder. Si ves “Conectado”, ya está listo.</p>
                          <Link href="/whatsapp" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Ir a conectar →</Link>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><Zap className="h-3.5 w-3.5 text-amber-600" /> Bot → Auto-Respuestas</div>
                          <p className="mt-1 text-xs text-muted-foreground">Palabra clave o regex → texto automático. Ej: si escriben “precio”, responde tu lista de precios.</p>
                          <Link href="/auto-responses" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Crear respuesta →</Link>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><Menu className="h-3.5 w-3.5 text-violet-600" /> Bot → Menús interactivos</div>
                          <p className="mt-1 text-xs text-muted-foreground">Menú con hasta 3 botones + submenús (2 niveles). Ideal para “1 Precios, 2 Horarios, 3 Ubicación”.</p>
                          <Link href="/menus" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Armar menú →</Link>
                        </div>
                        <div className={`rounded-xl border p-3 ${effectiveIsPro ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20 opacity-80"}`}>
                          <div className="flex items-center gap-2 text-xs font-semibold"><CalendarDays className={`h-3.5 w-3.5 ${effectiveIsPro ? "text-primary" : "text-muted-foreground"}`} /> Calendario {plan !== "pro" && <Badge className="ml-auto bg-amber-500 text-white border-transparent text-[9px]">Pro</Badge>}{effectiveIsPro && <Badge className="ml-auto bg-primary text-primary-foreground text-[9px]">Incluido</Badge>}</div>
                          <p className="mt-1 text-xs text-muted-foreground">{effectiveIsPro ? "Ver turnos, confirmar/cancelar y configurar horarios + link público /agendar para que clientes reserven solos." : "Solo Pro: turnos, agenda pública y recordatorios 24h. En Starter ves el acceso bloqueado."}</p>
                          <Link href="/calendar" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">{effectiveIsPro ? "Abrir calendario →" : "Ver qué incluye Pro →"}</Link>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><BarChart3 className="h-3.5 w-3.5 text-sky-600" /> Actividad</div>
                          <p className="mt-1 text-xs text-muted-foreground">Logs de qué respondió el bot, con qué keyword y cuándo. Útil para mejorar respuestas.</p>
                          <Link href="/logs" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Ver actividad →</Link>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/20 p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold"><User className="h-3.5 w-3.5 text-emerald-600" /> Mi Perfil</div>
                          <p className="mt-1 text-xs text-muted-foreground">Tus datos, plan y link público de agenda (si sos Pro). Copiá y compartí tu /agendar.</p>
                          <Link href="/profile" prefetch={false} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">Editar perfil →</Link>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border bg-muted/10 px-4 py-2.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> Flujo recomendado: 1) Conectá WhatsApp → 2) Creá 2-3 respuestas → 3) Probá con otro celular → {effectiveIsPro ? "4) Configurá Calendario" : "4) Upgradá a Pro si necesitás turnos"}.
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
