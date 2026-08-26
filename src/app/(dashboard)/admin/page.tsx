"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, Instance, UserInstance } from "@/lib/supabase/types";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  MessageCircleIcon,
  ShieldIcon,
  UsersIcon,
  ZapIcon,
  XIcon,
} from "@/components/icons";

interface AssignmentWithUser extends UserInstance {
  profiles?: { id: string; email: string; full_name: string | null };
}

interface Stats {
  totalUsers: number;
  totalInstances: number;
  connectedInstances: number;
  totalAutoResponses: number;
  activeAutoResponses: number;
  totalLogs: number;
  recentLogs24h: number;
  recentUsers7d: number;
}

// Stat card with gradient accent
function StatCard({
  icon,
  value,
  label,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-4 transition-all hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: accent }} />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-wa-text">{value}</p>
          <p className="text-[11px] text-wa-text-secondary">{label}</p>
        </div>
      </div>
      {sub && (
        <p className="relative mt-2 text-[10px] font-medium" style={{ color: accent }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, instRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/instances"),
        fetch("/api/admin/stats"),
      ]);

      const usersPayload = await usersRes.json();
      const instPayload = await instRes.json();
      const statsPayload = await statsRes.json();

      if (usersPayload.status === "success") setUsers(usersPayload.data);
      if (instPayload.status === "success") {
        setInstances(instPayload.data);
        if (instPayload.data.length > 0 && !selectedInstance) {
          setSelectedInstance(instPayload.data[0].id);
        }
      }
      if (statsPayload.status === "success") setStats(statsPayload.data);
    } catch {
      setFeedback({ kind: "error", message: "Error cargando datos" });
    }
    setLoading(false);
  }, [selectedInstance]);

  const loadAssignments = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(`/api/admin/assign?instanceId=${selectedInstance}`);
      const payload = await res.json();
      if (payload.status === "success") setAssignments(payload.data);
    } catch { /* silently fail */ }
  }, [selectedInstance]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadAssignments(); }, [loadAssignments]);
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  async function handleAssign(userId: string) {
    if (!selectedInstance) return;
    setAssigning(userId);
    setFeedback(null);
    try {
      const user = users.find((u) => u.id === userId);
      if (!user) return;
      const res = await fetch("/api/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: selectedInstance, userEmail: user.email }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `${user.email} asignado` });
        await loadAssignments();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setAssigning(null);
    }
  }

  async function handleUnassign(assignmentId: string, userEmail: string) {
    setAssigning(assignmentId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/assign?id=${assignmentId}`, { method: "DELETE" });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `${userEmail} desasignado` });
        await loadAssignments();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setAssigning(null);
    }
  }

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const selectedInst = instances.find((i) => i.id === selectedInstance);

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-wa-border bg-wa-header px-4 py-2.5">
        <ShieldIcon className="h-5 w-5 text-[#00a884]" />
        <span className="text-[0.9375rem] font-normal text-wa-text">Panel Admin</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mx-4 mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${
            feedback.kind === "success"
              ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">

            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard
                  icon={<UsersIcon className="h-5 w-5" />}
                  value={stats.totalUsers}
                  label="Usuarios"
                  accent="#53bdeb"
                  sub={stats.recentUsers7d > 0 ? `+${stats.recentUsers7d} esta semana` : undefined}
                />
                <StatCard
                  icon={<MessageCircleIcon className="h-5 w-5" />}
                  value={stats.totalInstances}
                  label="Instancias"
                  accent="#00a884"
                  sub={`${stats.connectedInstances} conectada${stats.connectedInstances !== 1 ? "s" : ""}`}
                />
                <StatCard
                  icon={<ZapIcon className="h-5 w-5" />}
                  value={stats.totalAutoResponses}
                  label="Auto-respuestas"
                  accent="#e6a44e"
                  sub={`${stats.activeAutoResponses} activa${stats.activeAutoResponses !== 1 ? "s" : ""}`}
                />
                <StatCard
                  icon={<ClockIcon className="h-5 w-5" />}
                  value={stats.totalLogs}
                  label="Respuestas enviadas"
                  accent="#00a884"
                  sub={stats.recentLogs24h > 0 ? `+${stats.recentLogs24h} en 24h` : undefined}
                />
              </div>
            )}

            {/* Instance selector */}
            {instances.length > 0 ? (
              <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-wa-text">Instancia activa</h3>
                  <span className="text-[10px] text-wa-text-secondary/50">{instances.length} total</span>
                </div>
                <select
                  value={selectedInstance}
                  onChange={(event) => setSelectedInstance(event.target.value)}
                  className="mt-3 input-field w-full max-w-xs text-sm"
                >
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.instance_name} ({inst.status === "open" ? "Conectada" : "Desconectada"})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-wa-border bg-wa-header p-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-wa-text-secondary/10">
                  <ShieldIcon className="h-7 w-7 text-wa-text-secondary/30" />
                </div>
                <p className="text-sm font-medium text-wa-text-secondary">No hay instancias creadas</p>
                <p className="mt-1 text-xs text-wa-text-secondary/50">Crea una en Configuracion primero</p>
              </div>
            )}

            {/* Users list */}
            {selectedInstance && (
              <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-wa-text">
                    Usuarios en {selectedInst?.instance_name}
                  </h3>
                  <span className="rounded-full bg-[#00a884]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#00a884]">
                    {assignedUserIds.size} asignados
                  </span>
                </div>

                {users.length === 0 ? (
                  <p className="text-xs text-wa-text-secondary">No hay usuarios registrados</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {users.map((user) => {
                      const isAssigned = assignedUserIds.has(user.id);
                      const isAdmin = user.role === "admin";
                      const isCurrentlyAssigning = assigning === user.id;

                      return (
                        <div
                          key={user.id}
                          className="group flex items-center justify-between gap-3 rounded-xl border border-wa-border/50 bg-wa-panel/50 px-4 py-3 transition-all hover:border-wa-border hover:bg-wa-panel"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#53bdeb]/20 to-[#53bdeb]/5 text-xs font-bold text-[#53bdeb]">
                              {user.email?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-wa-text truncate">{user.email}</p>
                              <p className="text-[10px] text-wa-text-secondary/50 truncate">
                                {user.full_name || "Sin nombre"}
                                {isAdmin && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#00a884]">
                                    <ShieldIcon className="h-2.5 w-2.5" /> Admin
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              isAssigned
                                ? void handleUnassign(
                                    assignments.find((a) => a.user_id === user.id && a.instance_id === selectedInstance)?.id || "",
                                    user.email || ""
                                  )
                                : void handleAssign(user.id)
                            }
                            disabled={isCurrentlyAssigning || isAdmin}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              isAdmin
                                ? "cursor-not-allowed opacity-40 border border-wa-border bg-wa-header text-wa-text-secondary"
                                : isAssigned
                                ? "border border-[#00a884]/30 bg-[#00a884]/10 text-[#00a884] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                : "border border-wa-border bg-wa-header text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                            }`}
                          >
                            {isCurrentlyAssigning ? (
                              <LoaderIcon className="mx-auto h-3.5 w-3.5 animate-spin" />
                            ) : isAssigned ? (
                              <span className="flex items-center gap-1"><CheckIcon className="h-3 w-3" /> Asignado</span>
                            ) : isAdmin ? (
                              "Admin"
                            ) : (
                              "Asignar"
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
