"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appointment, BusinessHours } from "@/lib/supabase/types";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  PenIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
  CalendarIcon,
  ShieldIcon,
} from "@/components/icons";
import { useUserPlan } from "@/hooks/useUserPlan";
import PlanPaywall from "@/components/PlanPaywall";

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const STATUS_META: Record<string, { label: string; accent: string }> = {
  pending: { label: "Pendiente", accent: "#e6a44e" },
  confirmed: { label: "Confirmada", accent: "#00a884" },
  canceled: { label: "Cancelada", accent: "#ef4444" },
  completed: { label: "Completada", accent: "#53bdeb" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_ES[d.getDay()]} ${d.getDate()}`;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export default function CalendarPage() {
  const { plan, isAdmin, loading: planLoading } = useUserPlan();
  const canEdit = isAdmin || plan === "pro" || plan === "community";
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Business hours form
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [hoursSchedule, setHoursSchedule] = useState<{ day: number; start: string; end: string; duration: number; active: boolean }[]>([]);
  const [savingHours, setSavingHours] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const instRes = await fetch("/api/instances");
      const instPayload = await instRes.json();
      if (instPayload.status === "success" && instPayload.data?.length > 0) {
        const id = instPayload.data[0].id;
        setInstanceId(id);

        // Load appointments for the week
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 14);

        const apptRes = await fetch(
          `/api/appointments?instanceId=${id}&from=${weekStart.toISOString().slice(0, 10)}&to=${weekEnd.toISOString().slice(0, 10)}`,
        );
        const apptPayload = await apptRes.json();
        if (apptPayload.status === "success") {
          setAppointments(apptPayload.data);
        }

        // Load business hours
        const hoursRes = await fetch(`/api/business-hours?instanceId=${id}`);
        const hoursPayload = await hoursRes.json();
        if (hoursPayload.status === "success") {
          setBusinessHours(hoursPayload.data);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Open the business-hours modal when navigating with ?config=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("config") === "1" && instanceId && canEdit) {
      openHoursForm();
    }
  }, [instanceId, canEdit]);

  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [appointments, statusFilter]);

  // Group appointments by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Appointment[]> = {};
    for (const appt of filteredAppointments) {
      if (!groups[appt.appointment_date]) groups[appt.appointment_date] = [];
      groups[appt.appointment_date].push(appt);
    }
    // Sort each group by time
    for (const date of Object.keys(groups)) {
      groups[date].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
    }
    return groups;
  }, [filteredAppointments]);

  const dateKeys = useMemo(() => Object.keys(groupedByDate).sort(), [groupedByDate]);

  async function handleStatusChange(apptId: string, newStatus: string) {
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: apptId, status: newStatus }),
    });
    const payload = await res.json();
    if (payload.status === "success") {
      setFeedback({ kind: "success", message: `Turno ${STATUS_META[newStatus]?.label || newStatus}` });
      await loadData();
    } else {
      setFeedback({ kind: "error", message: payload.error });
    }
  }

  function openHoursForm() {
    const schedule = [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const existing = businessHours.find((h) => h.day_of_week === day);
      return {
        day,
        start: existing?.start_time || "09:00",
        end: existing?.end_time || "18:00",
        duration: existing?.slot_duration_min || 30,
        active: existing?.is_active ?? (day >= 1 && day <= 5), // Mon-Fri active by default
      };
    });
    setHoursSchedule(schedule);
    setShowHoursForm(true);
  }

  async function handleSaveHours() {
    if (!instanceId) return;
    setSavingHours(true);
    const schedule = hoursSchedule.map((h) => ({
      dayOfWeek: h.day,
      startTime: h.start,
      endTime: h.end,
      slotDurationMin: h.duration,
      isActive: h.active,
    }));
    const res = await fetch("/api/business-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instanceId, schedule }),
    });
    const payload = await res.json();
    if (payload.status === "success") {
      setFeedback({ kind: "success", message: "Horarios guardados" });
      setShowHoursForm(false);
      await loadData();
    } else {
      setFeedback({ kind: "error", message: payload.error });
    }
    setSavingHours(false);
  }

  const activeHoursCount = businessHours.filter((h) => h.is_active).length;

  if (!planLoading && !canEdit) {
    return (
      <PlanPaywall
        requiredPlan="pro"
        currentPlan={plan}
        isAdmin={isAdmin}
        featureName="Calendario y Turnos"
        description="Gestioná agenda, turnos y recordatorios automáticos para tu negocio"
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Read-only banner */}
      {!planLoading && plan && !isAdmin && (
        <div className="flex items-center gap-2 bg-[#53bdeb]/10 px-4 py-2 text-xs text-[#53bdeb]">
          <ShieldIcon className="h-3.5 w-3.5" />
          Modo solo lectura — upgradeá a <strong>Pro</strong> para editar horarios y gestionar turnos
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
            <CalendarIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Calendario</p>
            <p className="text-[10px] text-wa-text-secondary/60">
              {appointments.length} turno{appointments.length !== 1 ? "s" : ""} esta semana
              {activeHoursCount > 0 && ` · ${activeHoursCount} día${activeHoursCount !== 1 ? "s" : ""} activo${activeHoursCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openHoursForm}
          disabled={!instanceId || !canEdit}
          className={`flex items-center gap-1.5 rounded-lg border border-wa-border bg-wa-header px-3 py-2 text-xs font-medium transition ${canEdit ? "text-wa-text-secondary hover:bg-wa-hover hover:text-wa-text" : "text-wa-text-secondary/40 cursor-not-allowed"}`}
        >
          <ClockIcon className="h-3.5 w-3.5" />
          Horarios
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs fade-up ${
          feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884]" : "bg-red-500/10 text-red-400"
        }`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 border-b border-wa-border bg-wa-header px-4 py-2.5 overflow-x-auto">
        {["all", "pending", "confirmed", "canceled", "completed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition ${
              statusFilter === s
                ? "bg-[#00a884]/15 text-[#00a884]"
                : "bg-wa-panel text-wa-text-secondary hover:bg-wa-hover"
            }`}
          >
            {s === "all" ? "Todas" : STATUS_META[s]?.label || s}
            {s !== "all" && (
              <span className="ml-1 opacity-60">
                {appointments.filter((a) => a.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!instanceId ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">Espera a tener una instancia asignada</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-[#00a884]/10 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5 ring-4 ring-[#00a884]/10">
                <CalendarIcon className="h-9 w-9 text-[#00a884]" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-wa-text">Sin turnos esta semana</p>
              <p className="mt-1 max-w-xs text-sm text-wa-text-secondary">
                Los turnos aparecerán cuando los clientes agenden vía WhatsApp
              </p>
            </div>
            <div className="rounded-xl border border-wa-border bg-wa-header p-4 max-w-xs text-center">
              <p className="text-xs text-wa-text-secondary/60">
                Configurá los <button onClick={openHoursForm} className="text-[#00a884] hover:underline">horarios del negocio</button> para que los clientes puedan agendar turnos
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {dateKeys.map((date) => {
              const dayAppts = groupedByDate[date];
              const isToday = date === new Date().toISOString().slice(0, 10);
              return (
                <div key={date}>
                  {/* Date header */}
                  <div className={`mb-2 flex items-center gap-2 ${isToday ? "text-[#00a884]" : ""}`}>
                    <span className={`text-xs font-semibold ${isToday ? "text-[#00a884]" : "text-wa-text-secondary"}`}>
                      {formatDate(date)}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-[#00a884]/15 px-2 py-0.5 text-[9px] font-bold text-[#00a884]">
                        HOY
                      </span>
                    )}
                    <span className="text-[10px] text-wa-text-secondary/40">
                      {dayAppts.length} turno{dayAppts.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Appointments — grid of compact cards */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {dayAppts.map((appt) => {
                      const meta = STATUS_META[appt.status] || STATUS_META.pending;
                      return (
                        <div
                          key={appt.id}
                          className="group flex flex-col rounded-xl border border-wa-border bg-wa-header p-3 transition hover:border-wa-text-secondary/20 hover:shadow-md hover:shadow-black/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            {/* Time */}
                            <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/10 text-[#00a884]">
                              <span className="text-[11px] font-bold">{formatTime(appt.appointment_time)}</span>
                            </div>
                            {/* Status */}
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                              style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}
                            >
                              {meta.label}
                            </span>
                          </div>

                          {/* Name */}
                          <p className="mt-2 truncate text-xs font-semibold text-wa-text">
                            {appt.customer_name || appt.customer_phone}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-wa-text-secondary/50">
                            {appt.customer_phone}
                            {appt.duration_min && ` · ${appt.duration_min} min`}
                            {appt.reminder_24h_sent && " · 🔔"}
                          </p>

                          {/* Actions */}
                          <div className="mt-2 flex gap-1 border-t border-wa-border/30 pt-2">
                            {appt.status === "pending" && canEdit && (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(appt.id, "confirmed")}
                                className="flex-1 rounded-md bg-[#00a884]/10 px-2 py-1 text-[10px] font-semibold text-[#00a884] transition hover:bg-[#00a884]/20"
                              >
                                Confirmar
                              </button>
                            )}
                            {appt.status !== "canceled" && appt.status !== "completed" && canEdit && (
                              <button
                                type="button"
                                onClick={() => void handleStatusChange(appt.id, "canceled")}
                                className="flex-1 rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400 transition hover:bg-red-500/20"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Business Hours Modal */}
      {showHoursForm && (
        <div className="modal-overlay" onClick={() => setShowHoursForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-wa-text">Horarios del negocio</h3>
                <p className="text-[10px] text-wa-text-secondary/60">Configurá los días y horarios de atención</p>
              </div>
              <button type="button" onClick={() => setShowHoursForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
              {hoursSchedule.map((h, idx) => (
                <div
                  key={h.day}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    h.active ? "border-[#00a884]/30 bg-[#00a884]/5" : "border-wa-border bg-wa-input opacity-60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...hoursSchedule];
                      next[idx] = { ...next[idx], active: !next[idx].active };
                      setHoursSchedule(next);
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${h.active ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                  >
                    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${h.active ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                  <span className="w-10 text-xs font-semibold text-wa-text">{DAYS_ES[h.day]}</span>
                  <input
                    type="time"
                    value={h.start}
                    onChange={(e) => {
                      const next = [...hoursSchedule];
                      next[idx] = { ...next[idx], start: e.target.value };
                      setHoursSchedule(next);
                    }}
                    disabled={!h.active}
                    className="rounded-lg border border-wa-border bg-wa-panel px-2 py-1.5 text-xs text-wa-text focus:border-[#00a884] focus:outline-none disabled:opacity-40"
                  />
                  <span className="text-wa-text-secondary/50">a</span>
                  <input
                    type="time"
                    value={h.end}
                    onChange={(e) => {
                      const next = [...hoursSchedule];
                      next[idx] = { ...next[idx], end: e.target.value };
                      setHoursSchedule(next);
                    }}
                    disabled={!h.active}
                    className="rounded-lg border border-wa-border bg-wa-panel px-2 py-1.5 text-xs text-wa-text focus:border-[#00a884] focus:outline-none disabled:opacity-40"
                  />
                  <select
                    value={h.duration}
                    onChange={(e) => {
                      const next = [...hoursSchedule];
                      next[idx] = { ...next[idx], duration: Number(e.target.value) };
                      setHoursSchedule(next);
                    }}
                    disabled={!h.active}
                    title="Duración del turno"
                    className="rounded-lg border border-wa-border bg-wa-panel px-1.5 py-1.5 text-xs text-wa-text focus:border-[#00a884] focus:outline-none disabled:opacity-40"
                  >
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1.5 h</option>
                    <option value={120}>2 h</option>
                  </select>
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHoursForm(false)}
                  className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveHours()}
                  disabled={savingHours}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {savingHours ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {savingHours ? "Guardando..." : "Guardar horarios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
