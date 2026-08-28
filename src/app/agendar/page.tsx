"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckIcon, LoaderIcon } from "@/components/icons";

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Slot {
  time: string;
  display: string;
}

interface DayAvailability {
  date: string;
  slots: Slot[];
}

interface InstanceAgenda {
  instanceId: string;
  instanceName: string;
  status: string;
  days: DayAvailability[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()}`;
}

function PublicAgendaContent() {
  const searchParams = useSearchParams();
  const business = searchParams.get("business");
  const user = searchParams.get("user");
  const hasIdentifier = Boolean(business || user);

  const [instances, setInstances] = useState<InstanceAgenda[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAgenda = useCallback(async () => {
    if (!business && !user) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (business) query.set("business", business);
      else if (user) query.set("user", user);
      const res = await fetch(`/api/public/agenda?${query.toString()}`);
      const payload = await res.json();
      if (payload.status === "success") {
        setInstances(payload.data.instances);
        if (payload.data.instances.length > 0) {
          setSelectedInstance(payload.data.instances[0].instanceId);
        }
      } else {
        setError(payload.error || "No se pudo cargar la agenda.");
      }
    } catch {
      setError("No se pudo cargar la disponibilidad. Intenta más tarde.");
    } finally {
      setLoading(false);
    }
  }, [business, user]);

  useEffect(() => {
    void loadAgenda();
  }, [loadAgenda]);

  const current = useMemo(
    () => instances.find((i) => i.instanceId === selectedInstance) ?? null,
    [instances, selectedInstance],
  );

  const selectedDay = useMemo(
    () => current?.days.find((d) => d.date === selectedDate) ?? null,
    [current, selectedDate],
  );

  async function handleBook() {
    if (!business && !user) return;
    if (!selectedInstance || !selectedDate || !selectedSlot) return;
    setBooking(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: business || undefined,
          userEmail: user || undefined,
          instanceId: selectedInstance,
          customerName: name || null,
          appointmentDate: selectedDate,
          appointmentTime: selectedSlot,
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setDone(true);
      } else {
        setFeedback(payload.error || "No se pudo reservar. Probá otro horario.");
        setSelectedSlot(null);
        await loadAgenda();
      }
    } catch {
      setFeedback("Error de red. Intentá de nuevo.");
    } finally {
      setBooking(false);
    }
  }

  if (!hasIdentifier) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-4">
        <p className="text-sm text-white/60">Link inválido. Contactá al negocio.</p>
      </div>
    );
  }

  const allDays = current ? current.days : [];

  return (
    <div className="min-h-screen bg-[#0b141a] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884]/15">
            <span className="text-xl">🗓️</span>
          </div>
          <h1 className="text-xl font-bold">Agendá tu turno</h1>
          <p className="mt-1 text-sm text-white/60">Elegí día y horario disponible</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {done ? (
          <div className="rounded-2xl border border-[#00a884]/30 bg-[#00a884]/10 p-8 text-center">
            <CheckIcon className="mx-auto mb-3 h-10 w-10 text-[#00a884]" />
            <p className="text-lg font-semibold">¡Turno reservado!</p>
            <p className="mt-1 text-sm text-white/60">Te contactarán para confirmar. ¡Nos vemos!</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-white/30" />
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/60">No hay disponibilidad en los próximos días.</p>
          </div>
        ) : selectedDate ? (
          /* Slot selection */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(null);
                setSelectedSlot(null);
              }}
              className="mb-4 text-xs text-white/50 hover:text-white"
            >
              ← Volver a los días
            </button>
            <h2 className="text-base font-semibold">{selectedDay ? formatDate(selectedDay.date) : ""}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {selectedDay?.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => setSelectedSlot(s.time)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    selectedSlot === s.time
                      ? "border-[#00a884] bg-[#00a884]/20 text-[#00a884]"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30"
                  }`}
                >
                  {s.display}
                </button>
              ))}
            </div>

            {selectedSlot && (
              <div className="mt-5 space-y-3 fade-up">
                <input
                  type="text"
                  placeholder="Tu nombre (opcional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#00a884] focus:outline-none"
                />
                {feedback && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                    {feedback}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleBook()}
                  disabled={booking}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {booking ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {booking ? "Reservando..." : "Confirmar turno"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Instance + day list */
          <div className="space-y-4">
            {instances.length > 1 && (
              <select
                value={selectedInstance || ""}
                onChange={(e) => {
                  setSelectedInstance(e.target.value);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#00a884] focus:outline-none"
              >
                {instances.map((i) => (
                  <option key={i.instanceId} value={i.instanceId} className="bg-[#0b141a]">
                    {i.instanceName}
                  </option>
                ))}
              </select>
            )}

            <div className="space-y-3">
              {allDays.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDate(d.date)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30"
                >
                  <div>
                    <p className="text-sm font-semibold">{formatDate(d.date)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#00a884]/15 px-2.5 py-1 text-[10px] font-semibold text-[#00a884]">
                    {d.slots.length} horarios
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicAgendaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0b141a]"><LoaderIcon className="h-8 w-8 animate-spin text-white/30" /></div>}>
      <PublicAgendaContent />
    </Suspense>
  );
}