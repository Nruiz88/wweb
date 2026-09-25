"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { UsersIcon, SearchIcon } from "@/components/icons";
import type { Profile, Instance } from "../../lib/db/types";

interface PlanUser {
  id: string; email: string | null; full_name: string | null; role: string; created_at: string;
  plan: string; status: string; max_instances: number; addons: number; used_instances: number;
  paid_until?: string | null; purchased_at?: string | null; latest_payment_amount?: number; latest_payment_status?: string;
}

interface Props {
  users: Profile[]; instances: Instance[]; plans: PlanUser[];
  onRefresh: () => void;
}

function planBadge(plan: string) {
  if (plan === "pro") return "bg-[#00a884]/15 text-[#00a884]";
  if (plan === "pending") return "bg-white/10 text-wa-text-secondary";
  return "bg-[#53bdeb]/15 text-[#53bdeb]";
}

export default function AdminUserManager({ plans, onRefresh }: Props) {
  const [changingField, setChangingField] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const EXPIRY_SOON_MS = 3 * 24 * 60 * 60 * 1000;
  /* eslint-disable react-hooks/purity -- time-based UI badge, re-evaluated per plans change */
  const expiringIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      plans.filter((p) => p.paid_until && new Date(p.paid_until).getTime() - now < EXPIRY_SOON_MS).map((p) => p.id)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);
  /* eslint-enable react-hooks/purity */

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return plans;
    const q = search.toLowerCase();
    return plans.filter((p) => p.email?.toLowerCase().includes(q) || p.full_name?.toLowerCase().includes(q));
  }, [plans, search]);

  async function handlePlanChange(userId: string, newPlan: string) {
    setChangingField(`plan-${userId}`);
    try {
      const res = await fetch("/api/admin/change-plan", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, planType: newPlan }) });
      const payload = await res.json();
      if (payload.status === "success") { onRefresh(); } else alert(payload.error ?? "Error");
    } catch { alert("Error de red"); } finally { setChangingField(null); }
  }

  async function handleAddonChange(userId: string, qty: number) {
    setChangingField(`addon-${userId}`);
    try {
      const res = await fetch("/api/admin/update-addon", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, quantity: qty }) });
      const payload = await res.json();
      if (payload.status === "success") { onRefresh(); } else alert(payload.error ?? "Error");
    } catch { alert("Error de red"); } finally { setChangingField(null); }
  }

  async function handleUpdateSubscription(userId: string, paidUntil: string, maxInstances?: number) {
    try {
      const res = await fetch("/api/admin/update-subscription", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, paid_until: paidUntil, max_instances: maxInstances }) });
      const payload = await res.json();
      if (payload.status === "success") { onRefresh(); } else alert(payload.error ?? "Error");
    } catch { alert("Error de red"); }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 shadow-xl shadow-black/10 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5 bg-gradient-to-r from-wa-header to-wa-header/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#53bdeb]/20 to-[#53bdeb]/5">
              <UsersIcon className="h-4.5 w-4.5 text-[#53bdeb]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-wa-text tracking-tight">Usuarios y suscripciones</h3>
              <p className="text-[10px] text-wa-text-secondary/50">{plans.length} registrados · cambiá plan, add-ons y vencimiento</p>
            </div>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wa-text-secondary/40" />
            <input
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-xl bg-white/5 border border-white/10 pl-9 pr-3.5 text-xs text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Cards en desktop / apiladas en mobile */}
      <div className="divide-y divide-white/5">
        {filteredUsers.length === 0 && (
          <p className="py-10 text-center text-xs text-wa-text-secondary/40">Sin resultados</p>
        )}
        {filteredUsers.map((planUser) => {
          const isExpiring = expiringIds.has(planUser.id);
          const menuOpen = rowMenu === planUser.id;
          return (
            <div key={planUser.id} className={`px-5 py-4 transition-colors ${isExpiring ? "bg-red-500/5" : "hover:bg-white/[0.02]"}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Identidad */}
                <div className="min-w-0 flex-1 basis-52">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-wa-text">{planUser.email || "—"}</p>
                    {planUser.role === "admin" && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold text-violet-300">ADMIN</span>
                    )}
                  </div>
                  {planUser.full_name && <p className="text-[10px] text-wa-text-secondary/50">{planUser.full_name}</p>}
                </div>

                {/* Plan + estado */}
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${planBadge(planUser.plan)}`}>
                    {planUser.plan === "pending" ? "sin plan" : planUser.plan}
                  </span>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${planUser.status === "active" ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"}`}>
                    {planUser.status === "active" ? "activo" : planUser.status}
                  </span>
                  {isExpiring && (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400">vence pronto</span>
                  )}
                </div>

                {/* Uso de bots */}
                <div className="min-w-[110px]">
                  <p className="text-[10px] font-semibold text-wa-text-secondary/50">
                    Bots: <b className="text-wa-text">{planUser.used_instances}/{planUser.max_instances}</b>
                    {planUser.addons > 0 && <span className="text-[#e6a44e]"> +{planUser.addons}</span>}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (planUser.used_instances / Math.max(1, planUser.max_instances)) * 100)}%`,
                        backgroundColor: planUser.used_instances >= planUser.max_instances ? "#ef4444" : "#00a884",
                      }}
                    />
                  </div>
                </div>

                {/* Vencimiento + pago */}
                <div className="text-right">
                  <p className="text-[10px] text-wa-text-secondary/50">
                    Vence: <b className="text-wa-text/80">{planUser.paid_until ? new Date(planUser.paid_until).toLocaleDateString("es-AR") : "—"}</b>
                  </p>
                  {planUser.latest_payment_amount ? (
                    <p className="text-[10px] text-wa-text-secondary/50">
                      Último pago: <b className="text-[#00a884]">${Math.round(planUser.latest_payment_amount).toLocaleString("es-AR")}</b>
                    </p>
                  ) : null}
                </div>

                {/* Acciones */}
                <div className="relative">
                  <button
                    onClick={() => setRowMenu(menuOpen ? null : planUser.id)}
                    className="h-8 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-bold text-wa-text transition-all hover:bg-white/10"
                  >
                    Gestionar ▾
                  </button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
                      <div className="absolute right-0 top-9 z-50 w-64 rounded-2xl border border-white/10 bg-wa-header p-3 shadow-2xl shadow-black/40">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-wa-text-secondary/40">Cambiar plan</p>
                        <div className="mb-3 flex gap-1.5">
                          <button
                            onClick={() => { handlePlanChange(planUser.id, "starter"); setRowMenu(null); }}
                            disabled={changingField === `plan-${planUser.id}` || planUser.plan === "starter"}
                            className="flex-1 rounded-lg bg-[#53bdeb]/15 px-2 py-1.5 text-[10px] font-bold text-[#53bdeb] transition-all hover:bg-[#53bdeb]/25 disabled:opacity-40"
                          >
                            Starter
                          </button>
                          <button
                            onClick={() => { handlePlanChange(planUser.id, "pro"); setRowMenu(null); }}
                            disabled={changingField === `plan-${planUser.id}` || planUser.plan === "pro"}
                            className="flex-1 rounded-lg bg-[#00a884]/15 px-2 py-1.5 text-[10px] font-bold text-[#00a884] transition-all hover:bg-[#00a884]/25 disabled:opacity-40"
                          >
                            Pro
                          </button>
                        </div>

                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-wa-text-secondary/40">Bots extra (add-on)</p>
                        <input
                          type="number"
                          min={0}
                          defaultValue={planUser.addons}
                          className="mb-3 h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-wa-text focus:border-[#00a884]/50 focus:outline-none"
                          onBlur={(e) => { const v = Number(e.target.value); if (v !== planUser.addons) handleAddonChange(planUser.id, v); }}
                        />

                        <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-wa-text-secondary/40">Vence el</p>
                        <input
                          type="date"
                          defaultValue={planUser.paid_until ? planUser.paid_until.slice(0, 10) : ""}
                          className="h-8 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-wa-text focus:border-[#00a884]/50 focus:outline-none"
                          onChange={(e) => { if (e.target.value) { handleUpdateSubscription(planUser.id, new Date(e.target.value).toISOString()); setRowMenu(null); } }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
