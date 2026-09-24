"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Crown, Zap, Check } from "lucide-react";
import { toast } from "sonner";

interface PlanOption {
  plan_type: string;
  label: string;
  amount_cents: number;
  description: string;
}

export default function PlanSelect() {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mercado-pago").then(r => r.json()).then(d => {
      if (d.data?.plans) setPlans(d.data.plans);
      else setPlans([
        { plan_type: "starter", label: "Starter", amount_cents: 0, description: "Bot básico, keywords y menú" },
        { plan_type: "pro", label: "Pro", amount_cents: 15000, description: "Calendario, turnos, regex y bot base" },
      ]);
    }).catch(() => setPlans([
      { plan_type: "starter", label: "Starter", amount_cents: 0, description: "Bot básico, keywords y menú" },
      { plan_type: "pro", label: "Pro", amount_cents: 15000, description: "Calendario, turnos, regex y bot base" },
    ]));
  }, []);

  async function handleConfirm() {
    if (!selected) { toast.error("Seleccioná un plan"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/confirm-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planType: selected }) });
      const data = await res.json();
      if (data.status === "success") {
        if (selected === "pro" && data.data?.requires_payment) {
          window.location.href = "/api/payments/preference";
        } else {
          window.location.href = "/dashboard";
        }
      } else toast.error(data.error || "Error");
    } catch { toast.error("Error de red"); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card/40 to-primary/[0.08] px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Elegí tu plan</h1>
          <p className="text-muted-foreground">Seleccioná la opción que se adapte a vos y empezá hoy.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((p) => {
            const isSelected = selected === p.plan_type;
            const price = p.amount_cents === 0 ? "Gratis" : `$${(p.amount_cents / 100).toFixed(0)}`;
            return (
              <button
                key={p.plan_type}
                onClick={() => setSelected(p.plan_type)}
                className={`group relative rounded-3xl border-2 p-6 text-left transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 ${isSelected ? "border-primary bg-gradient-to-br from-primary/[0.08] to-card shadow-primary/20" : "border-muted bg-card hover:border-primary/40"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg ${p.plan_type === "pro" ? "bg-gradient-to-br from-primary to-emerald-600 text-white" : "bg-gradient-to-br from-blue-500 to-sky-400 text-white"}`}>
                      {p.plan_type === "pro" ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-foreground">{p.label}</h3>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Plan {p.plan_type}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-black text-foreground tracking-tight">{price}</span>
                  {p.amount_cents > 0 && <span className="text-sm text-muted-foreground"> / mes</span>}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{p.description}</p>

                <ul className="space-y-2 text-sm text-foreground">
                  {(p.plan_type === "pro" ? ["Calendario de turnos", "Regex avanzado", "Recordatorios 24h", "Bot base + extras"] : ["Keywords automáticas", "Menú interactivo", "Bot base"]).map((feat) => (
                    <li key={feat} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> <span className="text-xs font-medium">{feat}</span></li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button onClick={handleConfirm} disabled={!selected || loading} size="lg" className="rounded-2xl px-10 py-6 text-base font-extrabold shadow-xl shadow-primary/25 hover:shadow-2xl transition-all bg-gradient-to-r from-primary to-emerald-600">
            {loading ? "Confirmando..." : selected === "pro" ? "Pagar y activar Pro" : "Confirmar plan Starter"}
          </Button>
        </div>

        {selected && (
          <p className="text-center text-xs text-muted-foreground">Seleccionado: <strong className="text-foreground">{plans.find((p) => p.plan_type === selected)?.label}</strong></p>
        )}
      </div>
    </div>
  );
}
