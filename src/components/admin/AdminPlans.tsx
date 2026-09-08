"use client";

import { useState } from "react";
import { CheckIcon, XIcon } from "@/components/icons";

interface PlanUser {
  id: string; email: string | null; full_name: string | null; role: string; created_at: string;
  plan: string; status: string; max_instances: number; addons: number; used_instances: number;
}

interface PlansPayload {
  plan_distribution: { starter: number; pro: number; community: number };
  active_subscriptions: number;
  total_addons: number;
  users: PlanUser[];
}

const PLAN_META: Record<string, { label: string; accent: string; features: string[] }> = {
  starter: { label: "Starter", accent: "#53bdeb", features: ["1 bot", "Keywords"] },
  pro: { label: "Pro", accent: "#00a884", features: ["1 bot base", "Horarios", "Regex"] },
  community: { label: "Community", accent: "#e6a44e", features: ["1 bot base", "Moderación", "Broadcasts"] },
};

export default function AdminPlans({ plans, onRefresh }: { plans: PlansPayload; onRefresh: () => void }) {
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function handlePlanChange(userId: string, newPlan: string) {
    setChangingPlan(userId);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/change-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planType: newPlan }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `Plan cambiado a ${newPlan}` });
        onRefresh();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setChangingPlan(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
      {feedback && (
        <div className={`mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-semibold backdrop-blur-sm transition-all ${feedback.kind === "success" ? "bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
          {feedback.kind === "success" ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6a44e]/20 to-[#e6a44e]/5">
            <span className="text-sm">💳</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-wa-text tracking-tight">Planes de suscripción</h3>
            <p className="text-[10px] text-wa-text-secondary/50">{plans.active_subscriptions} activas · {plans.total_addons} bots extra</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["starter", "pro", "community"] as const).map((key) => {
          const meta = PLAN_META[key];
          const count = plans.plan_distribution[key] ?? 0;
          const total = Object.values(plans.plan_distribution).reduce((a, b) => a + b, 0) || 1;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="group rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ backgroundColor: `${meta.accent}18`, color: meta.accent }}>
                  {meta.label}
                </span>
                <span className="text-xl font-extrabold text-wa-text">{count}</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: meta.accent }} />
              </div>
              <p className="mt-2 text-[10px] text-wa-text-secondary/50 font-medium">{meta.features.join(" · ")}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-wa-text-secondary/40">
              <th className="py-2.5 pr-3 font-semibold">Usuario</th>
              <th className="py-2.5 pr-3 font-semibold">Plan</th>
              <th className="py-2.5 pr-3 font-semibold">Bots usados</th>
              <th className="py-2.5 pr-3 font-semibold">Límite</th>
              <th className="py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {plans.users.filter((u) => u.role !== "admin").map((u) => {
              const meta = PLAN_META[u.plan] ?? PLAN_META.starter;
              const usagePct = Math.min(100, (u.used_instances / u.max_instances) * 100);
              const full = u.used_instances >= u.max_instances;
              return (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 pr-3">
                    <p className="truncate font-bold text-wa-text">{u.email ?? u.full_name}</p>
                    {u.addons > 0 && <p className="text-[10px] font-semibold text-[#e6a44e]">+{u.addons} bot{u.addons !== 1 ? "s" : ""} add-on</p>}
                  </td>
                  <td className="py-3 pr-3">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${meta.accent}18`, color: meta.accent }}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-wa-text font-bold">
                    {u.used_instances}<span className="text-wa-text-secondary/40">/{u.max_instances}</span>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="w-24">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${usagePct}%`, backgroundColor: full ? "#ef4444" : "#00a884" }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    {u.role !== "admin" ? (
                      <select
                        value={u.plan}
                        onChange={(e) => void handlePlanChange(u.id, e.target.value)}
                        disabled={changingPlan === u.id}
                        className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-wa-text focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="community">Community</option>
                      </select>
                    ) : (
                      <span className="text-[10px] text-wa-text-secondary/30">—</span>
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
