"use client";

import { useState } from "react";
import { LoaderIcon, CheckIcon, XIcon } from "@/components/icons";

interface PlanUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  plan: string;
  status: string;
  max_instances: number;
  addons: number;
  used_instances: number;
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
    <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
      {feedback && (
        <div className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-wa-text">Planes de suscripcion</h3>
        <span className="text-[10px] text-wa-text-secondary/50">
          {plans.active_subscriptions} activas · {plans.total_addons} bots extra
        </span>
      </div>

      {/* Plan distribution */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["starter", "pro", "community"] as const).map((key) => {
          const meta = PLAN_META[key];
          const count = plans.plan_distribution[key] ?? 0;
          const total = Object.values(plans.plan_distribution).reduce((a, b) => a + b, 0) || 1;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={key} className="rounded-xl border border-wa-border/50 bg-wa-panel/50 p-3.5 transition hover:border-wa-border">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}>
                  {meta.label}
                </span>
                <span className="text-lg font-bold text-wa-text">{count}</span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-wa-text-secondary/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.accent }} />
              </div>
              <p className="mt-1.5 text-[10px] text-wa-text-secondary/60">{meta.features.join(" · ")}</p>
            </div>
          );
        })}
      </div>

      {/* Users table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-wa-border text-[10px] uppercase tracking-wide text-wa-text-secondary/50">
              <th className="py-2 pr-3 font-medium">Usuario</th>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Bots usados</th>
              <th className="py-2 pr-3 font-medium">Limite</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {plans.users.filter((u) => u.role !== "admin").map((u) => {
              const meta = PLAN_META[u.plan] ?? PLAN_META.starter;
              const usagePct = Math.min(100, (u.used_instances / u.max_instances) * 100);
              const full = u.used_instances >= u.max_instances;
              return (
                <tr key={u.id} className="border-b border-wa-border/40 last:border-0">
                  <td className="py-2.5 pr-3">
                    <p className="truncate font-medium text-wa-text">{u.email ?? u.full_name}</p>
                    {u.addons > 0 && <p className="text-[10px] text-[#e6a44e]">+{u.addons} bot{u.addons !== 1 ? "s" : ""} add-on</p>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-wa-text">
                    {u.used_instances}<span className="text-wa-text-secondary/50">/{u.max_instances}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="w-24">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-wa-text-secondary/10">
                        <div className="h-full rounded-full" style={{ width: `${usagePct}%`, backgroundColor: full ? "#ef4444" : "#00a884" }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5">
                    {u.role !== "admin" ? (
                      <select
                        value={u.plan}
                        onChange={(e) => void handlePlanChange(u.id, e.target.value)}
                        disabled={changingPlan === u.id}
                        className="rounded-lg border border-wa-border bg-wa-input px-2 py-1 text-[10px] font-medium text-wa-text focus:border-[#00a884] focus:outline-none"
                      >
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="community">Community</option>
                      </select>
                    ) : (
                      <span className="text-[10px] text-wa-text-secondary/50">—</span>
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
