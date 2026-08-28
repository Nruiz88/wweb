"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Profile, Instance, UserInstance } from "@/lib/supabase/types";
import { CheckIcon, LoaderIcon, ShieldIcon, SearchIcon, XIcon, PenIcon } from "@/components/icons";

interface AssignmentWithUser extends UserInstance {
  profiles?: { id: string; email: string; full_name: string | null };
}

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

interface Props {
  users: Profile[];
  instances: Instance[];
  plans: PlanUser[];
  selectedInstance: string;
  onSelectInstance: (id: string) => void;
  onRefresh: () => void;
}

const PLAN_META: Record<string, { label: string; accent: string }> = {
  starter: { label: "Starter", accent: "#53bdeb" },
  pro: { label: "Pro", accent: "#00a884" },
  community: { label: "Community", accent: "#e6a44e" },
};

export default function AdminUserManager({ users, instances, plans, selectedInstance, onSelectInstance, onRefresh }: Props) {
  const [assignments, setAssignments] = useState<AssignmentWithUser[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [changingField, setChangingField] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  const loadAssignments = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const res = await fetch(`/api/admin/assign?instanceId=${selectedInstance}`);
      const payload = await res.json();
      if (payload.status === "success") setAssignments(payload.data);
    } catch { /* silently fail */ }
  }, [selectedInstance]);

  useEffect(() => {
    const t = setTimeout(() => void loadAssignments(), 0);
    return () => clearTimeout(t);
  }, [loadAssignments]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const selectedInst = instances.find((i) => i.id === selectedInstance);

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

  async function handlePlanChange(userId: string, newPlan: string) {
    setChangingField(`plan-${userId}`);
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
      setChangingField(null);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setChangingField(`role-${userId}`);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/change-role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `Rol cambiado a ${newRole}` });
        onRefresh();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setChangingField(null);
    }
  }

  return (
    <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
      {/* Feedback */}
      {feedback && (
        <div className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Header + Instance selector + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-wa-text">Gestion de usuarios</h3>
          <span className="rounded-full bg-[#00a884]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#00a884]">
            {users.length} total · {assignedUserIds.size} asignados
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-wa-text-secondary/40" />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 rounded-lg border border-wa-border bg-wa-input pl-8 pr-3 py-1.5 text-xs text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-wa-text-secondary/40 hover:text-wa-text-secondary">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Instance selector */}
          {instances.length > 0 && (
            <select
              value={selectedInstance}
              onChange={(event) => onSelectInstance(event.target.value)}
              className="rounded-lg border border-wa-border bg-wa-input px-2.5 py-1.5 text-xs text-wa-text focus:border-[#00a884] focus:outline-none"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.instance_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* User list */}
      <div className="mt-4 space-y-2">
        {filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-xs text-wa-text-secondary">
            {search ? "No se encontraron usuarios" : "No hay usuarios registrados"}
          </p>
        ) : (
          filteredUsers.map((user) => {
            const isAssigned = assignedUserIds.has(user.id);
            const userPlan = planMap.get(user.id);
            const plan = userPlan?.plan ?? "starter";
            const meta = PLAN_META[plan] ?? PLAN_META.starter;
            const isEditing = editingUser === user.id;
            const isCurrentlyAssigning = assigning === user.id;
            const usage = userPlan?.used_instances ?? 0;
            const max = userPlan?.max_instances ?? 1;

            return (
              <div key={user.id} className="rounded-xl border border-wa-border/50 bg-wa-panel/50 transition-all hover:border-wa-border hover:bg-wa-panel">
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#53bdeb]/20 to-[#53bdeb]/5 text-xs font-bold text-[#53bdeb]">
                    {user.email?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-wa-text">{user.email}</p>
                      {user.role === "admin" && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[#00a884]/10 px-1.5 py-0.5 text-[8px] font-semibold text-[#00a884]">
                          <ShieldIcon className="h-2 w-2" /> Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-wa-text-secondary/50 truncate">
                      {user.full_name || "Sin nombre"} · {usage}/{max} bots
                    </p>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Plan badge */}
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}
                    >
                      {meta.label}
                    </span>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => setEditingUser(isEditing ? null : user.id)}
                      className="rounded-lg p-1.5 text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                      title="Editar"
                    >
                      <PenIcon className="h-3.5 w-3.5" />
                    </button>

                    {/* Assign/Unassign */}
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
                      disabled={isCurrentlyAssigning || !selectedInstance}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-medium transition ${
                        isAssigned
                          ? "border border-[#00a884]/30 bg-[#00a884]/10 text-[#00a884]"
                          : "border border-wa-border bg-wa-header text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text"
                      }`}
                    >
                      {isCurrentlyAssigning ? (
                        <LoaderIcon className="h-3 w-3 animate-spin" />
                      ) : isAssigned ? (
                        "Asignado"
                      ) : (
                        "Asignar"
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded edit panel */}
                {isEditing && (
                  <div className="border-t border-wa-border/30 bg-wa-header/50 px-4 py-3 fade-up">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {/* Role */}
                      <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-wa-text-secondary/60">
                          Rol
                        </label>
                        <select
                          value={user.role}
                          onChange={(e) => void handleRoleChange(user.id, e.target.value)}
                          disabled={changingField === `role-${user.id}`}
                          className="w-full rounded-lg border border-wa-border bg-wa-input px-2.5 py-1.5 text-xs font-medium text-wa-text focus:border-[#00a884] focus:outline-none"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>

                      {/* Plan */}
                      <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-wa-text-secondary/60">
                          Plan
                        </label>
                        <select
                          value={plan}
                          onChange={(e) => void handlePlanChange(user.id, e.target.value)}
                          disabled={changingField === `plan-${user.id}`}
                          className="w-full rounded-lg border border-wa-border bg-wa-input px-2.5 py-1.5 text-xs font-medium text-wa-text focus:border-[#00a884] focus:outline-none"
                        >
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="community">Community</option>
                        </select>
                      </div>

                      {/* Instance assignment */}
                      <div>
                        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-wa-text-secondary/60">
                          Servidor
                        </label>
                        {isAssigned ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleUnassign(
                                assignments.find((a) => a.user_id === user.id && a.instance_id === selectedInstance)?.id || "",
                                user.email || ""
                              )
                            }
                            disabled={isCurrentlyAssigning}
                            className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                          >
                            {isCurrentlyAssigning ? "..." : "Desasignar"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleAssign(user.id)}
                            disabled={isCurrentlyAssigning}
                            className="w-full rounded-lg border border-wa-border bg-wa-header px-2.5 py-1.5 text-xs font-medium text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text disabled:opacity-40"
                          >
                            {isCurrentlyAssigning ? "..." : `Asignar a ${selectedInst?.instance_name || "servidor"}`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Usage bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-wa-text-secondary/50">Bots: {usage}/{max}</span>
                        <span className="text-[10px] text-wa-text-secondary/50">
                          {userPlan?.addons ? `+${userPlan.addons} add-ons` : "Sin add-ons"}
                        </span>
                      </div>
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-wa-text-secondary/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (usage / max) * 100)}%`,
                            backgroundColor: usage >= max ? "#ef4444" : "#00a884",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
