"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { UsersIcon } from "@/components/icons";
import type { Profile, Instance } from "@/lib/supabase/types";

interface PlanUser {
  id: string; email: string | null; full_name: string | null; role: string; created_at: string;
  plan: string; status: string; max_instances: number; addons: number; used_instances: number;
  paid_until?: string | null; purchased_at?: string | null; latest_payment_amount?: number; latest_payment_status?: string;
}

interface Props {
  users: Profile[]; instances: Instance[]; plans: PlanUser[];
  selectedInstance: string; onSelectInstance: (id: string) => void; onRefresh: () => void;
}

export default function AdminUserManager({ users, instances, plans, selectedInstance, onSelectInstance, onRefresh }: Props) {
  const [assignments, setAssignments] = useState<Array<{ user_id: string }>>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [changingField, setChangingField] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const EXPIRY_SOON_MS = 3 * 24 * 60 * 60 * 1000;
  /* eslint-disable react-hooks/purity -- time-based UI badge, re-evaluated per plans change */
  const expiringIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      plans.filter((p) => p.paid_until && new Date(p.paid_until).getTime() - now < EXPIRY_SOON_MS).map((p) => p.id)
    );
  }, [plans, EXPIRY_SOON_MS]);
  /* eslint-enable react-hooks/purity */

  const loadAssignments = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(`/api/admin/assign?instanceId=${selectedInstance}`);
      const payload = await res.json();
      if (payload.status === "success") setAssignments(payload.data);
    } catch { }
  }, [selectedInstance]);

  useEffect(() => { const t = setTimeout(() => void loadAssignments(), 0); return () => clearTimeout(t); }, [loadAssignments]);

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

  async function handleAssign(userId: string) {
    if (!selectedInstance) return;
    setAssigning(userId);
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      const res = await fetch("/api/admin/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instanceId: selectedInstance, userEmail: user.email }) });
      const payload = await res.json();
      if (payload.status === "success") { await loadAssignments(); } else alert(payload.error ?? "Error");
    } catch { alert("Error de red"); } finally { setAssigning(null); }
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
              <h3 className="text-sm font-bold text-wa-text tracking-tight">Usuarios, planes y pagos</h3>
              <p className="text-[10px] text-wa-text-secondary/50">Ver, modificar y asignar servidores</p>
            </div>
          </div>
          <input
            placeholder="Buscar usuario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs rounded-xl bg-white/5 border border-white/10 px-3.5 text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-wa-text-secondary/40">
              <th className="text-left px-5 py-3 font-semibold">Usuario</th>
              <th className="text-left px-3 py-3 font-semibold">Plan</th>
              <th className="text-left px-3 py-3 font-semibold">Estado</th>
              <th className="text-left px-3 py-3 font-semibold">Bots</th>
              <th className="text-left px-3 py-3 font-semibold">Add-ons</th>
              <th className="text-left px-3 py-3 font-semibold">Pago</th>
              <th className="text-left px-3 py-3 font-semibold">Vence</th>
              <th className="text-left px-3 py-3 font-semibold">Acciones</th>
              <th className="text-left px-3 py-3 font-semibold">Servidor</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((planUser) => {
              const assigned = assignments.find((a) => a.user_id === planUser.id);
              const isExpiring = expiringIds.has(planUser.id);
              return (
                <tr key={planUser.id} className={`border-b border-white/5 last:border-0 transition-colors ${isExpiring ? "bg-red-500/5" : "hover:bg-white/[0.02]"}`}>
                  <td className="px-5 py-3.5 font-bold text-wa-text truncate max-w-[160px]">{planUser.email || "—"}</td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${planUser.plan === "pro" ? "bg-[#00a884]/15 text-[#00a884]" : "bg-[#53bdeb]/15 text-[#53bdeb]"}`}>
                      {planUser.plan}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${planUser.status === "active" ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"}`}>
                      {planUser.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-wa-text font-bold">{planUser.max_instances}</td>
                  <td className="px-3 py-3.5 text-wa-text font-bold">{planUser.addons}</td>
                  <td className="px-3 py-3.5 text-wa-text-secondary/50 font-medium">{planUser.latest_payment_amount ? `$${(planUser.latest_payment_amount / 100).toFixed(0)}` : "—"}</td>
                  <td className="px-3 py-3.5 text-wa-text/70 font-medium">{planUser.paid_until ? new Date(planUser.paid_until).toLocaleDateString("es-AR") : "—"}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        className="h-7 px-2.5 rounded-xl text-[10px] border border-white/10 bg-white/5 hover:bg-white/10 font-bold text-wa-text transition-all duration-200 disabled:opacity-50"
                        onClick={() => handlePlanChange(planUser.id, planUser.plan === "pro" ? "starter" : "pro")}
                        disabled={changingField === `plan-${planUser.id}`}
                      >
                        {changingField === `plan-${planUser.id}` ? "..." : planUser.plan === "pro" ? "A starter" : "A pro"}
                      </button>
                      <input
                        type="number"
                        defaultValue={planUser.addons}
                        className="h-7 w-14 text-[10px] rounded-xl px-2 border border-white/10 bg-white/5 text-wa-text focus:border-[#00a884]/50 focus:outline-none transition-all"
                        onBlur={(e) => handleAddonChange(planUser.id, Number(e.target.value))}
                      />
                      <input
                        type="date"
                        defaultValue={planUser.paid_until ? planUser.paid_until.slice(0, 10) : ""}
                        className="h-7 w-28 text-[10px] rounded-xl px-2 border border-white/10 bg-white/5 text-wa-text focus:border-[#00a884]/50 focus:outline-none transition-all"
                        onBlur={(e) => handleUpdateSubscription(planUser.id, e.target.value ? new Date(e.target.value).toISOString() : "")}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {assigned ? (
                      <span className="inline-block text-[10px] rounded-xl px-2.5 py-0.5 bg-[#00a884]/15 text-[#00a884] font-bold">Asignado</span>
                    ) : (
                      <button
                        className="h-7 px-2.5 rounded-xl text-[10px] border border-white/10 bg-white/5 hover:bg-white/10 font-bold text-wa-text transition-all duration-200 disabled:opacity-50"
                        onClick={() => handleAssign(planUser.id)}
                        disabled={assigning === planUser.id}
                      >
                        {assigning === planUser.id ? "..." : "Asig."}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
