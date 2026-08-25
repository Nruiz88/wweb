"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, Instance, UserInstance } from "@/lib/supabase/types";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  MessageCircleIcon,
  ShieldIcon,
  UserIcon,
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
          className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            feedback.kind === "success"
              ? "bg-[#00a884]/10 text-[#00a884]"
              : "bg-red-500/10 text-red-400"
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
                {/* Users */}
                <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-[#53bdeb]/10 text-[#53bdeb]">
                      <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold text-wa-text">{stats.totalUsers}</p>
                      <p className="text-[10px] sm:text-xs text-wa-text-secondary truncate">Usuarios</p>
                    </div>
                  </div>
                  {stats.recentUsers7d > 0 && (
                    <p className="mt-2 text-[10px] text-[#53bdeb]">
                      +{stats.recentUsers7d} esta semana
                    </p>
                  )}
                </div>

                {/* Instances */}
                <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/10 text-[#00a884]">
                      <MessageCircleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold text-wa-text">{stats.totalInstances}</p>
                      <p className="text-[10px] sm:text-xs text-wa-text-secondary truncate">Instancias</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[#00a884]">
                    {stats.connectedInstances} conectada{stats.connectedInstances !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Auto Responses */}
                <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-[#e6a44e]/10 text-[#e6a44e]">
                      <ZapIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold text-wa-text">{stats.totalAutoResponses}</p>
                      <p className="text-[10px] sm:text-xs text-wa-text-secondary truncate">Auto-respuestas</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-[#e6a44e]">
                    {stats.activeAutoResponses} activa{stats.activeAutoResponses !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Responses sent */}
                <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/10 text-[#00a884]">
                      <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold text-wa-text">{stats.totalLogs}</p>
                      <p className="text-[10px] sm:text-xs text-wa-text-secondary truncate">Respuestas enviadas</p>
                    </div>
                  </div>
                  {stats.recentLogs24h > 0 && (
                    <p className="mt-2 text-[10px] text-[#00a884]">
                      +{stats.recentLogs24h} en 24h
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Instance selector */}
            {instances.length > 0 ? (
              <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                <h3 className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold text-wa-text">Seleccionar instancia</h3>
                <select
                  value={selectedInstance}
                  onChange={(event) => setSelectedInstance(event.target.value)}
                  className="input-field w-full max-w-xs text-sm"
                >
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.instance_name} ({inst.status === "open" ? "Conectada" : "Desconectada"})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl border border-wa-border bg-wa-header p-6 text-center">
                <ShieldIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-wa-text-secondary/20" />
                <p className="mt-2 text-sm text-wa-text-secondary">No hay instancias creadas</p>
                <p className="text-xs text-wa-text-secondary/60">Crea una en Configuracion primero</p>
              </div>
            )}

            {/* Users list with assign buttons */}
            {selectedInstance && (
              <div className="rounded-xl border border-wa-border bg-wa-header p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-semibold text-wa-text truncate">
                    Usuarios — {selectedInst?.instance_name}
                  </h3>
                  <span className="text-[10px] sm:text-xs text-wa-text-secondary shrink-0 ml-2">
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
                          className="flex items-center justify-between gap-2 rounded-lg border border-wa-border/50 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-[#53bdeb]/10 text-[#53bdeb] text-xs font-bold">
                              {user.email?.[0]?.toUpperCase() || "?"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm text-wa-text truncate">{user.email}</p>
                              <p className="text-[10px] text-wa-text-secondary/50 truncate">
                                {user.full_name || "Sin nombre"}
                                {isAdmin && (
                                  <span className="ml-1 text-[#00a884]">• Admin</span>
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
                            className={`shrink-0 min-w-[70px] sm:min-w-[90px] rounded-lg px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-medium transition ${
                              isAdmin
                                ? "cursor-not-allowed opacity-40 border border-wa-border bg-wa-header text-wa-text-secondary"
                                : isAssigned
                                ? "border border-[#00a884]/30 bg-[#00a884]/10 text-[#00a884] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                : "border border-wa-border bg-wa-header text-wa-text-secondary hover:bg-wa-hover"
                            }`}
                          >
                            {isCurrentlyAssigning ? (
                              <LoaderIcon className="mx-auto h-3.5 w-3.5 animate-spin" />
                            ) : isAssigned ? (
                              "Asignado ✓"
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
