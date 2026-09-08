"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { LoaderIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [planSelected, setPlanSelected] = useState<string | null>(null);
  const [step, setStep] = useState<"register" | "plan">("register");
  const [planConfig, setPlanConfig] = useState<Array<{ plan_type: string; label: string; amount_cents: number; description?: string }>>([]);

  useEffect(() => {
    async function loadPlans() {
      try {
        const res = await fetch("/api/admin/mercado-pago");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.data?.plans)) {
            setPlanConfig(data.data.plans);
          }
        }
      } catch {
        // fallback
        setPlanConfig([
          { plan_type: "starter", label: "Starter", amount_cents: 0, description: "Plan básico sin costo" },
          { plan_type: "pro", label: "Pro", amount_cents: 15000, description: "Plan profesional" },
        ]);
      }
    }
    loadPlans();
  }, []);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Move to plan selection
    setStep("plan");
    setLoading(false);
  }

  async function handleConfirmPlan() {
    if (!planSelected) {
      setError("Seleccioná un plan");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/confirm-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: planSelected }),
      });
      const data = await res.json();
      if (data.status === "success") {
        if (planSelected === "pro" && data.data?.requires_payment) {
          // For pro, redirect to preference endpoint or show payment info
          window.location.href = "/api/payments/preference"; // Client-side redirect to initiate preference (simplified)
          return;
        }
        setSuccess(true);
      } else {
        setError(data.error || "Error al confirmar plan");
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <Logo size="lg" className="mx-auto justify-center" />
          <h1 className="mt-4 text-xl font-semibold text-wa-text">¡Plan confirmado!</h1>
          <p className="mt-2 text-sm text-wa-text-secondary">
            Tu cuenta está activa. Podés iniciar sesión.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-[#00a884] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  if (step === "plan") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Logo size="lg" className="mx-auto justify-center" />
            <div className="text-center">
              <h2 className="text-lg font-semibold text-wa-text">Elegí tu plan</h2>
              <p className="text-sm text-wa-text-secondary">Seleccioná la opción que se adapte a vos.</p>
            </div>
          </div>

          <div className="space-y-4">
            {planConfig.map((p) => (
              <button
                key={p.plan_type}
                type="button"
                onClick={() => setPlanSelected(p.plan_type)}
                className={`w-full rounded-xl border p-5 text-left transition ${
                  planSelected === p.plan_type
                    ? "border-[#00a884] bg-[#00a884]/10 ring-1 ring-[#00a884]"
                    : "border-muted hover:border-[#00a884]/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-wa-text">{p.label}</h3>
                    <p className="mt-1 text-xs text-wa-text-secondary">{p.description || "Plan básico"}</p>
                    <p className="mt-2 text-sm font-bold text-[#00a884]">
                      {p.amount_cents === 0 ? "Gratis" : `$${(p.amount_cents / 100).toFixed(2)}`}
                    </p>
                  </div>
                  {planSelected === p.plan_type && (
                    <span className="text-[#00a884] font-medium text-xs">Seleccionado</span>
                  )}
                </div>
              </button>
            ))}

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmPlan}
              disabled={loading || !planSelected}
              className="w-full rounded-lg bg-[#00a884] px-4 py-3 text-sm font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50"
            >
              {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Confirmar plan"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" className="mx-auto justify-center" />
          <div className="text-center">
            <p className="text-sm text-wa-text-secondary">Registrate para empezar</p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-xs font-medium text-wa-text-secondary">Nombre completo</label>
            <input id="fullName" type="text" required autoComplete="name" placeholder="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-wa-text-secondary">Email</label>
            <input id="email" type="email" required autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-wa-text-secondary">Contraseña</label>
            <input id="password" type="password" required autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-xs font-medium text-wa-text-secondary">Confirmar contraseña</label>
            <input id="confirmPassword" type="password" required autoComplete="new-password" placeholder="Repite tu contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />
          </div>

          <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50">
            {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p className="text-center text-sm text-wa-text-secondary">
            ¿Ya tienes cuenta?{" "}
            <a href="/login" className="text-[#00a884] hover:underline">Inicia sesión</a>
          </p>
        </form>
      </div>
    </div>
  );
}