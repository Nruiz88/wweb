"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, Instance } from "@/lib/db/types";
import { ShieldIcon, LoaderIcon, UsersIcon, MessageCircleIcon } from "@/components/icons";
import { Activity as ActivityIcon, CreditCard as CreditCardIcon, RefreshCw as RefreshIcon } from "lucide-react";
import AdminStats from "@/components/admin/AdminStats";
import AdminActivityChart from "@/components/admin/AdminActivityChart";
import AdminInstanceManager from "@/components/admin/AdminInstanceManager";
import AdminMP from "@/components/admin/AdminMP";
import AdminUserManager from "@/components/admin/AdminUserManager";

interface Stats {
  totalUsers: number;
  totalInstances: number;
  connectedInstances: number;
  totalAutoResponses: number;
  activeAutoResponses: number;
  totalLogs: number;
  recentLogs24h: number;
  recentUsers7d: number;
  totalAppointments: number;
  pendingAppointments: number;
}

interface PlansPayload {
  plan_distribution: { starter: number; pro: number };
  active_subscriptions: number;
  total_addons: number;
  users: { id: string; email: string | null; full_name: string | null; role: string; created_at: string; plan: string; status: string; max_instances: number; addons: number; used_instances: number }[];
}

interface ActivityPayload {
  series: { date: string; label: string; responses: number; newUsers: number }[];
  topKeywords: { keyword: string; count: number }[];
}

const TABS = [
  { id: "overview", label: "Resumen", icon: ActivityIcon },
  { id: "users", label: "Usuarios", icon: UsersIcon },
  { id: "instances", label: "Instancias", icon: MessageCircleIcon },
  { id: "billing", label: "Facturación", icon: CreditCardIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<PlansPayload | null>(null);
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [usersRes, instRes, statsRes, plansRes, activityRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/instances?lite=1"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/plans"),
        fetch("/api/admin/activity"),
      ]);

      const usersPayload = await usersRes.json();
      const instPayload = await instRes.json();
      const statsPayload = await statsRes.json();
      const plansPayload = await plansRes.json();
      const activityPayload = await activityRes.json();

      if (usersPayload.status === "success") setUsers(usersPayload.data);
      if (instPayload.status === "success") setInstances(instPayload.data);
      if (statsPayload.status === "success") setStats(statsPayload.data);
      if (plansPayload.status === "success") setPlans(plansPayload.data);
      if (activityPayload.status === "success") setActivity(activityPayload.data);
    } catch {
      // non-critical
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-wa-panel via-wa-panel to-wa-header/40">
      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-wa-header via-wa-header to-wa-header/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#00a884] to-[#25d366] shadow-lg shadow-[#00a884]/20">
              <ShieldIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-wa-text tracking-tight">Panel Admin</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-wa-text-secondary transition-all hover:bg-white/10 hover:text-wa-text disabled:opacity-50"
            title="Recargar datos"
          >
            {refreshing ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <RefreshIcon className="h-3 w-3" />}
            {refreshing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-5 pb-0 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-white/[0.06] text-[#00a884]"
                    : "text-wa-text-secondary hover:text-wa-text hover:bg-white/5"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`} />
                {tab.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[#00a884] to-[#25d366]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <LoaderIcon className="h-7 w-7 animate-spin text-[#00a884]/60" />
              <p className="text-xs text-wa-text-secondary/50">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            {activeTab === "overview" && (
              <>
                {stats && <AdminStats stats={stats} planDistribution={plans?.plan_distribution ?? null} activeSubscriptions={plans?.active_subscriptions ?? 0} />}
                {activity && <AdminActivityChart activity={activity} />}
              </>
            )}

            {activeTab === "users" && plans && (
              <AdminUserManager
                users={users}
                instances={instances}
                plans={plans.users}
                onRefresh={() => void loadData(true)}
              />
            )}

            {activeTab === "instances" && (
              <AdminInstanceManager instances={instances} users={users} onRefresh={() => void loadData(true)} />
            )}

            {activeTab === "billing" && (
              <AdminMP />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
