"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, Instance } from "@/lib/supabase/types";
import { ShieldIcon, LoaderIcon, UsersIcon, MessageCircleIcon, ClockIcon, SettingsIcon } from "@/components/icons";
import AdminStats from "@/components/admin/AdminStats";
import AdminPlans from "@/components/admin/AdminPlans";
import AdminActivity from "@/components/admin/AdminActivity";
import AdminServers from "@/components/admin/AdminServers";
import AdminInstanceManager from "@/components/admin/AdminInstanceManager";
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
  totalAddonBots: number;
  totalAppointments: number;
  pendingAppointments: number;
  totalGroupSettings: number;
  totalBroadcasts: number;
  completedBroadcasts: number;
}

interface ServerCapacity {
  server_url: string;
  instance_count: number;
  max_instances: number;
  remaining: number;
  instances: { id: string; instance_name: string; status: string; user_count: number; users: { id: string; email: string; full_name: string | null }[] }[];
}

interface PlansPayload {
  plan_distribution: { starter: number; pro: number; community: number };
  active_subscriptions: number;
  total_addons: number;
  users: { id: string; email: string | null; full_name: string | null; role: string; created_at: string; plan: string; status: string; max_instances: number; addons: number; used_instances: number }[];
}

interface ActivityPayload {
  series: { date: string; label: string; responses: number; newUsers: number }[];
  topKeywords: { keyword: string; count: number }[];
}

const TABS = [
  { id: "users", label: "Usuarios", icon: UsersIcon },
  { id: "instances", label: "Instancias", icon: MessageCircleIcon },
  { id: "activity", label: "Actividad", icon: ClockIcon },
  { id: "servers", label: "Servidores", icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [capacities, setCapacities] = useState<ServerCapacity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [plans, setPlans] = useState<PlansPayload | null>(null);
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("users");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, instRes, statsRes, capRes, plansRes, activityRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/instances"),
        fetch("/api/admin/stats"),
        fetch("/api/admin/instances-with-users"),
        fetch("/api/admin/plans"),
        fetch("/api/admin/activity"),
      ]);

      const usersPayload = await usersRes.json();
      const instPayload = await instRes.json();
      const statsPayload = await statsRes.json();
      const capPayload = await capRes.json();
      const plansPayload = await plansRes.json();
      const activityPayload = await activityRes.json();

      if (usersPayload.status === "success") setUsers(usersPayload.data);
      if (instPayload.status === "success") {
        setInstances(instPayload.data);
        if (instPayload.data.length > 0 && !selectedInstance) {
          setSelectedInstance(instPayload.data[0].id);
        }
      }
      if (statsPayload.status === "success") setStats(statsPayload.data);
      if (capPayload.status === "success") setCapacities(capPayload.data);
      if (plansPayload.status === "success") setPlans(plansPayload.data);
      if (activityPayload.status === "success") setActivity(activityPayload.data);
    } catch {
      // non-critical
    }
    setLoading(false);
  }, [selectedInstance]);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="border-b border-wa-border bg-wa-header">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <ShieldIcon className="h-5 w-5 text-[#00a884]" />
          <span className="text-[0.9375rem] font-normal text-wa-text">Panel Admin</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto px-4 pb-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#00a884] bg-wa-panel text-[#00a884]"
                    : "text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Stats always visible */}
            {stats && <AdminStats stats={stats} />}

            {/* Tab content */}
            {activeTab === "users" && plans && (
              <AdminUserManager
                users={users}
                instances={instances}
                plans={plans.users}
                selectedInstance={selectedInstance}
                onSelectInstance={setSelectedInstance}
                onRefresh={loadData}
              />
            )}

            {activeTab === "instances" && (
              <>
                <AdminInstanceManager instances={instances} users={users} onRefresh={loadData} />
                {plans && <AdminPlans plans={plans} onRefresh={loadData} />}
              </>
            )}

            {activeTab === "activity" && activity && (
              <AdminActivity activity={activity} />
            )}

            {activeTab === "servers" && (
              <AdminServers capacities={capacities} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
