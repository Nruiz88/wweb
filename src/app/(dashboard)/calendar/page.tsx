"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appointment, BusinessHours } from "@/lib/supabase/types";
import { useUserPlan } from "@/hooks/useUserPlan";
import PlanPaywall from "@/components/PlanPaywall";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Shield, Check, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useRouter } from "next/navigation";
import { todayInBusinessTimezone } from "@/lib/timezone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_META: Record<string, { label: string; accent: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendiente", accent: "#e6a44e", variant: "secondary" },
  confirmed: { label: "Confirmada", accent: "#00a884", variant: "default" },
  canceled: { label: "Cancelada", accent: "#ef4444", variant: "destructive" },
  completed: { label: "Completada", accent: "#53bdeb", variant: "outline" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_ES[d.getDay()]} ${d.getDate()}`;
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

// zod schema for business-hours (per requirement)
const hoursRowSchema = z
  .object({
    day: z.number().min(0).max(6),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
    duration: z.number().min(15, "Mín 15 min"),
    active: z.boolean(),
  })
  .refine((d) => d.start < d.end, { message: "Inicio debe ser < fin", path: ["end"] });

const hoursFormSchema = z.object({
  schedule: z.array(hoursRowSchema).length(7),
});
type HoursFormValues = z.infer<typeof hoursFormSchema>;

export default function CalendarPage() {
  const { plan, isAdmin, loading: planLoading } = useUserPlan();
  const canEdit = isAdmin || plan === "pro";
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Filters — hoy en zona Buenos Aires (no UTC)
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Business hours form — RHF + zod + Drawer
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  const hoursForm = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
    defaultValues: {
      schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        start: "09:00",
        end: "18:00",
        duration: 30,
        active: day >= 1 && day <= 5,
      })),
    },
  });
  const watchedSchedule = hoursForm.watch("schedule");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const instRes = await fetch("/api/instances?lite=1");
      const instPayload = await instRes.json();
      if (instPayload.status === "success" && instPayload.data?.length > 0) {
        const id = instPayload.data[0].id;
        setInstanceId(id);

        const nowStr = todayInBusinessTimezone();
        const now = new Date(`${nowStr}T12:00:00`);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 14);

        const [apptRes, hoursRes] = await Promise.all([
          fetch(
            `/api/appointments?instanceId=${id}&from=${weekStart.toISOString().slice(0, 10)}&to=${weekEnd.toISOString().slice(0, 10)}`,
          ),
          fetch(`/api/business-hours?instanceId=${id}`),
        ]);
        const apptPayload = await apptRes.json();
        if (apptPayload.status === "success") {
          setAppointments(apptPayload.data);
        }
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

  const searchParams = useSearchParams();
  const routerNav = useRouter();
  const isConfigMode = searchParams.get("config") === "1";

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
      toast.success(`Turno ${STATUS_META[newStatus]?.label || newStatus}`);
      await loadData();
    } else {
      setFeedback({ kind: "error", message: payload.error });
      toast.error(payload.error);
    }
  }

  async function handleDeleteAppt(apptId: string) {
    if (!confirm("Eliminar este turno?")) return;
    const res = await fetch(`/api/appointments?id=${apptId}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.status === "success") {
      setFeedback({ kind: "success", message: "Turno eliminado" });
      toast.success("Turno eliminado");
      await loadData();
    } else {
      setFeedback({ kind: "error", message: payload.error });
      toast.error(payload.error);
    }
  }

  function waLink(phone: string | null): string | null {
    const digits = (phone || "").replace(/\D/g, "");
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }

  const onSubmitHours = hoursForm.handleSubmit(async (values) => {
    if (!instanceId) return;
    setSavingHours(true);
    const schedule = values.schedule.map((h) => ({
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
      toast.success("Horarios guardados");
      setShowHoursForm(false);
      await loadData();
    } else {
      setFeedback({ kind: "error", message: payload.error });
      toast.error(payload.error);
    }
    setSavingHours(false);
  });

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
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Read-only banner */}
      {!planLoading && plan && !isAdmin && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-xs font-medium text-sky-300">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          Modo solo lectura — upgradeá a <strong>Pro</strong> para editar horarios y gestionar turnos
        </div>
      )}

      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25">
              <Calendar className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">{isConfigMode ? "Horarios del negocio" : "Calendario"}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{isConfigMode ? "Configurá días, horarios y duración por turno" : `${appointments.length} turno${appointments.length !== 1 ? "s" : ""} esta semana`}</p>
          </div>
          {isConfigMode ? (
            <Button variant="ghost" onClick={() => routerNav.push("/calendar")} className="text-slate-300">Ver turnos</Button>
          ) : (
            <Button variant="ghost" onClick={() => routerNav.push("/calendar?config=1")} className="text-slate-300 h-9 rounded-xl gap-1.5 border border-white/[0.08] hover:bg-white/[0.05]"><Clock className="h-4 w-4" />Horarios</Button>
          )}
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("mx-4 sm:mx-6 mb-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium", feedback.kind === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-rose-400/30 bg-rose-500/10 text-rose-300")}>
            {feedback.kind === "success" ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {isConfigMode ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-md shadow-xl shadow-black/20 overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-slate-100">Horarios y duración por turno</span>
              <span className="ml-auto text-[10px] font-bold text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20">{activeHoursCount} activos</span>
            </div>
            <div className="p-4 space-y-3">
              <form onSubmit={onSubmitHours} className="space-y-3">
                {watchedSchedule?.map((h, idx) => {
                  const errStart = hoursForm.formState.errors.schedule?.[idx]?.start;
                  const errEnd = hoursForm.formState.errors.schedule?.[idx]?.end;
                  return (
                    <div key={h.day} className={cn("flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 rounded-xl border px-3 sm:px-4 py-3", h.active ? "border-cyan-400/20 bg-cyan-500/5" : "border-white/[0.06] bg-white/[0.02] opacity-60")}>
                      <button type="button" onClick={() => hoursForm.setValue(`schedule.${idx}.active`, !h.active, { shouldValidate: true })} className={cn("relative h-6 w-11 shrink-0 rounded-full", h.active ? "bg-cyan-400" : "bg-slate-600")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", h.active ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
                      <span className="w-8 sm:w-10 shrink-0 text-xs font-semibold text-slate-300">{DAYS_ES[h.day]}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1"><Input type="time" {...hoursForm.register(`schedule.${idx}.start`)} disabled={!h.active} className={cn("h-8 min-w-0 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200", errStart && "border-rose-400/50")} />{errStart && <span className="text-[10px] text-rose-400">{errStart.message}</span>}</div>
                      <span className="text-slate-500 shrink-0 text-xs">a</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1"><Input type="time" {...hoursForm.register(`schedule.${idx}.end`)} disabled={!h.active} className={cn("h-8 min-w-0 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200", errEnd && "border-rose-400/50")} />{errEnd && <span className="text-[10px] text-rose-400">{errEnd.message}</span>}</div>
                      <select value={h.duration} onChange={(e) => hoursForm.setValue(`schedule.${idx}.duration`, Number(e.target.value), { shouldValidate: true })} disabled={!h.active} className="flex h-8 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 text-xs text-slate-200">
                        <option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hora</option><option value={90}>1.5 h</option><option value={120}>2 h</option>
                      </select>
                    </div>
                  );
                })}
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => routerNav.push("/calendar")} className="flex-1 border-white/[0.08] text-slate-300">Cancelar</Button>
                  <Button type="submit" disabled={savingHours} className="flex-1 gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20">{savingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Status filter */}
          <div className="mx-4 sm:mx-6 mb-3 flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {["all", "pending", "confirmed", "canceled", "completed"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1", statusFilter === s ? "bg-gradient-to-br from-cyan-400/20 to-violet-400/20 text-cyan-300 border border-cyan-400/30 shadow-sm" : "text-slate-500 hover:text-slate-300")}>
                {s === "all" ? "Todas" : STATUS_META[s]?.label || s}
                {s !== "all" && <span className="opacity-60 text-[10px]">{appointments.filter(a => a.status === s).length}</span>}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
            {!instanceId ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
                <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Espera a tener una instancia asignada</p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl bg-white/[0.03]" />)}
              </div>
            ) : appointments.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-white/[0.06] bg-white/[0.01] p-12 text-center">
                <div className="relative inline-block mb-3">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                  <div className="relative h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-400/20">
                    <Calendar className="h-8 w-8 text-cyan-400" />
                  </div>
                </div>
                <p className="text-base font-semibold text-slate-300">Sin turnos esta semana</p>
                <p className="text-xs text-slate-500 mt-1">Los turnos aparecerán cuando los clientes agenden vía WhatsApp</p>
              </div>
            ) : (
              <div className="space-y-6">
                {dateKeys.map((date) => {
                  const dayAppts = groupedByDate[date];
                  const isToday = date === todayInBusinessTimezone();
                  return (
                    <div key={date}>
                      <div className={cn("mb-3 flex items-center gap-2", isToday ? "text-cyan-400" : "")}>
                        <span className={cn("text-xs font-semibold", isToday ? "text-cyan-400" : "text-slate-500")}>{formatDate(date)}</span>
                        {isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">HOY</span>}
                        <span className="text-[11px] text-slate-600">{dayAppts.length} turno{dayAppts.length !== 1 ? "s" : ""}</span>
                      </div>
                      <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {dayAppts.map((appt) => {
                          const meta = STATUS_META[appt.status] || STATUS_META.pending;
                          return (
                            <motion.div key={appt.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.3, ease: "easeOut" }}>
                              <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-md shadow-xl shadow-black/20 hover:border-white/[0.12] transition-all h-full">
                                <div className="p-3 flex flex-col h-full">
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="h-8 w-14 rounded-lg bg-cyan-400/10 text-cyan-400 flex items-center justify-center border border-cyan-400/20">
                                      <span className="text-[11px] font-bold">{formatTime(appt.appointment_time)}</span>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${meta.accent}15`, color: meta.accent, borderColor: `${meta.accent}30` }}>{meta.label}</span>
                                  </div>
                                  <p className="text-sm font-semibold truncate text-slate-100">{appt.customer_name || (appt.customer_phone ? `+${appt.customer_phone}` : "Turno sin datos")}</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {appt.customer_phone ? (
                                      <a href={waLink(appt.customer_phone) || "#"} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-medium">💬 {appt.customer_phone}</a>
                                    ) : "sin teléfono"}
                                    {appt.duration_min && ` · ${appt.duration_min} min`}
                                  </p>
                                  <Separator className="my-2.5 bg-white/[0.06]" />
                                  <div className="flex gap-1.5 mt-auto">
                                    {appt.status === "pending" && canEdit && (
                                      <Button size="sm" variant="outline" onClick={() => void handleStatusChange(appt.id, "confirmed")} className="flex-1 text-[11px] border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10">Confirmar</Button>
                                    )}
                                    {appt.status !== "canceled" && appt.status !== "completed" && canEdit && (
                                      <Button size="sm" variant="outline" onClick={() => void handleStatusChange(appt.id, "canceled")} className="flex-1 text-[11px] border-white/[0.08] text-slate-400 hover:text-rose-400 hover:border-rose-400/30">Cancelar</Button>
                                    )}
                                    {(appt.status === "canceled" || appt.status === "completed") && canEdit && (
                                      <Button size="sm" variant="outline" onClick={() => void handleDeleteAppt(appt.id)} className="flex-1 text-[11px] border-rose-400/30 text-rose-400 hover:bg-rose-400/10"><Trash2 className="h-3 w-3" />Borrar</Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Business Hours modal legacy (mantenido por compatibilidad, oculto en modo config inline) */}
      <AnimatePresence>
        {showHoursForm && !isConfigMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 hidden items-center justify-center bg-black/60 p-4 backdrop-blur-md md:flex" onClick={() => setShowHoursForm(false)}>
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ duration: 0.2 }} onClick={(e) => e.stopPropagation()} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <p className="text-base font-semibold text-slate-100">Horarios del negocio</p>
                <Button variant="ghost" size="icon" onClick={() => setShowHoursForm(false)} className="h-8 w-8 text-slate-400"><X className="h-4 w-4" /></Button>
              </div>
              <form onSubmit={onSubmitHours} className="flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {watchedSchedule?.map((h, idx) => (
                    <div key={h.day} className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                      <button type="button" onClick={() => hoursForm.setValue(`schedule.${idx}.active`, !h.active)} className={cn("relative h-6 w-11 shrink-0 rounded-full", h.active ? "bg-cyan-400" : "bg-slate-600")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", h.active ? "translate-x-[22px]" : "translate-x-0.5")} /></button>
                      <span className="w-8 sm:w-10 shrink-0 text-xs font-semibold text-slate-300">{DAYS_ES[h.day]}</span>
                      <Input type="time" {...hoursForm.register(`schedule.${idx}.start`)} disabled={!h.active} className="h-8 min-w-0 text-xs flex-1 bg-white/[0.04] border-white/[0.08] text-slate-200" />
                      <span className="text-xs text-slate-500">a</span>
                      <Input type="time" {...hoursForm.register(`schedule.${idx}.end`)} disabled={!h.active} className="h-8 min-w-0 text-xs flex-1 bg-white/[0.04] border-white/[0.08] text-slate-200" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 border-t border-white/[0.06] p-4">
                  <Button type="button" variant="ghost" onClick={() => setShowHoursForm(false)} className="flex-1 text-slate-300">Cancelar</Button>
                  <Button type="submit" disabled={savingHours} className="flex-1 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold">{savingHours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
