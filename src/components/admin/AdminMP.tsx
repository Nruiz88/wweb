"use client";
import { useState, useEffect } from "react";
import { CreditCard, Key, DollarSign, Save, X, Edit3, Shield, Bot } from "lucide-react";

// Convención del proyecto: la DB guarda CENTAVOS (amount_cents).
// El admin muestra y edita en PESOS. Al guardar se multiplica x100.
const toPesos = (cents: number) => Math.round((cents ?? 0) / 100);
const toCents = (pesos: number) => Math.round((Number(pesos) || 0) * 100);
const fmt = (pesos: number) => `$${Number(pesos || 0).toLocaleString("es-AR")}`;

interface MPPlanRow {
  plan_type: string;
  amount_cents: number;
  label?: string;
  description?: string;
  max_instances?: number;
  addon_price_cents?: number;
}

interface MPConfigRow {
  access_token?: string | null;
  public_key?: string | null;
  webhook_secret?: string | null;
  addon_price_cents?: number | null;
}

interface MPPayload {
  status: string;
  data?: { plans?: MPPlanRow[]; mp_config?: MPConfigRow | null };
}

export default function AdminMP() {
  const [mp, setMp] = useState<MPPayload | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [addonPrice, setAddonPrice] = useState<number>(0);
  const [mpKeys, setMpKeys] = useState({ access_token: "", public_key: "", webhook_secret: "" });

  function load() {
    fetch("/api/admin/mercado-pago").then(r => r.json()).then(d => {
      setMp(d);
      const init: Record<string, number> = {};
      (d?.data?.plans || []).forEach((p: MPPlanRow) => { init[p.plan_type] = toPesos(p.amount_cents ?? 0); });
      setPrices(init);
      setAddonPrice(toPesos(d?.data?.mp_config?.addon_price_cents ?? 0));
      const conf = d?.data?.mp_config;
      if (conf) setMpKeys({ access_token: conf.access_token || "", public_key: conf.public_key || "", webhook_secret: conf.webhook_secret || "" });
    }).catch(() => { /* panel keeps defaults; retry on next mount/save */ });
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const plans = Object.entries(prices).map(([plan_type, pesos]) => ({ plan_type, amount_cents: toCents(pesos) }));
    await fetch("/api/admin/mercado-pago", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plans,
        addon_price_cents: toCents(addonPrice),
        access_token: mpKeys.access_token,
        public_key: mpKeys.public_key,
        webhook_secret: mpKeys.webhook_secret,
      }),
    });
    load();
    setEditMode(false);
  }

  const data = mp?.data;
  const plans = (data?.plans || []).map((p: MPPlanRow) => ({
    plan_type: p.plan_type,
    label: p.plan_type === "starter" ? "Starter" : p.plan_type === "pro" ? "Pro" : p.plan_type === "community" ? "Community" : "Plan",
    amount_cents: p.amount_cents,
    description: p.description,
    max_instances: p.max_instances,
  }));

  return (
    <div className="space-y-5">
      {/* Config status */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/5">
              <CreditCard className="h-4.5 w-4.5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-wa-text tracking-tight">Configuración Mercado Pago</h2>
              <p className="text-[10px] text-wa-text-secondary/50 mt-0.5">Estado: {data?.mp_config ? <span className="text-[#00a884] font-bold">Configurado</span> : <span className="text-red-400 font-bold">No configurado</span>}</p>
            </div>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200"
            style={editMode
              ? { backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }
              : { background: "linear-gradient(135deg, #00a884, #25d366)", color: "white", boxShadow: "0 4px 12px rgba(0,168,132,0.25)" }
            }
          >
            {editMode ? <><X className="h-3.5 w-3.5" /> Cancelar</> : <><Edit3 className="h-3.5 w-3.5" /> Editar</>}
          </button>
        </div>
      </div>

      {/* Plans & Prices (valores en PESOS) */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6a44e]/20 to-[#e6a44e]/5">
            <DollarSign className="h-4.5 w-4.5 text-[#e6a44e]" />
          </div>
          <h3 className="text-sm font-bold text-wa-text tracking-tight">Planes y precios</h3>
        </div>
        <p className="text-[10px] text-wa-text-secondary/50 mb-4 ml-12">Valores en pesos argentinos ($). Se guardan en centavos automáticamente.</p>
        <div className="grid md:grid-cols-2 gap-3">
          {plans.map((plan) => (
            <div key={plan.plan_type} className="group rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-wa-text">{plan.label}</h3>
                {editMode ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-wa-text-secondary/50">$</span>
                    <input
                      type="number"
                      min={0}
                      className="w-28 h-8 text-sm font-extrabold text-right rounded-xl border border-white/10 bg-white/5 px-2 text-wa-text focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                      value={prices[plan.plan_type] ?? toPesos(plan.amount_cents)}
                      onChange={e => setPrices({ ...prices, [plan.plan_type]: Number(e.target.value) })}
                    />
                  </div>
                ) : (
                  <span className="text-lg font-extrabold text-[#00a884]">{fmt(toPesos(plan.amount_cents))}</span>
                )}
              </div>
              <p className="text-[11px] text-wa-text-secondary/50 mb-3 leading-relaxed">{plan.description}</p>
              <div className="flex gap-4 text-[11px] text-wa-text-secondary/40 font-medium">
                <span>Instancias: <b className="text-wa-text">{plan.max_instances}</b></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bot extra (add-on) */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#53bdeb]/20 to-[#53bdeb]/5">
            <Bot className="h-4.5 w-4.5 text-[#53bdeb]" />
          </div>
          <h3 className="text-sm font-bold text-wa-text tracking-tight">Bot extra (add-on)</h3>
        </div>
        <p className="text-[10px] text-wa-text-secondary/50 mb-4 ml-12">Precio mensual por cada bot adicional. Valor en pesos ($).</p>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-wa-text">Precio del bot extra</p>
              <p className="text-[10px] text-wa-text-secondary/50 mt-0.5">Se cobra por cada instancia adicional</p>
            </div>
            {editMode ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-wa-text-secondary/50">$</span>
                <input
                  type="number"
                  min={0}
                  className="w-28 h-9 text-sm font-extrabold text-right rounded-xl border border-white/10 bg-white/5 px-2 text-wa-text focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                  value={addonPrice}
                  onChange={e => setAddonPrice(Number(e.target.value))}
                />
              </div>
            ) : (
              <span className="text-lg font-extrabold text-[#53bdeb]">{fmt(addonPrice)}</span>
            )}
          </div>
        </div>
      </div>

      {/* MP Keys */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Key className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-wa-text tracking-tight">Claves Mercado Pago</h3>
        </div>
        <div className="space-y-3">
          {[
            { key: "access_token" as const, label: "Access Token", icon: <Key className="h-3.5 w-3.5" /> },
            { key: "public_key" as const, label: "Public Key", icon: <Shield className="h-3.5 w-3.5" /> },
            { key: "webhook_secret" as const, label: "Webhook Secret", icon: <Shield className="h-3.5 w-3.5" /> },
          ].map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-wa-text-secondary uppercase tracking-wider">
                {field.icon} {field.label}
              </label>
              <input
                type="password"
                className="w-full h-10 rounded-xl border border-white/10 bg-white/5 px-3.5 text-xs text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                value={mpKeys[field.key]}
                onChange={e => setMpKeys({ ...mpKeys, [field.key]: e.target.value })}
                placeholder={`Tu ${field.label}`}
              />
            </div>
          ))}
        </div>
      </div>

      {editMode && (
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#00a884]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#00a884]/30 hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #00a884, #25d366)" }}
        >
          <Save className="h-4 w-4" />
          Guardar cambios
        </button>
      )}
    </div>
  );
}
