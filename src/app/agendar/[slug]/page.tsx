"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckIcon, LoaderIcon } from "@/components/icons";

/* =========================================================
   Agenda pública: /agendar/<slug>
   =========================================================
   Esta página la usan los clientes finales del comercio. No tienen
   cuenta en Nexo Studio ni aquí, y por eso no pide sesión.

   QUÉ CAMBIÓ RESPECTO A LA VERSIÓN ANTERIOR
   -----------------------------------------
   Antes era `/agendar?business=<nombre del negocio>`, y el backend
   buscaba a quién pertenecía ese nombre comparándolo con TODOS los
   usuarios de la tabla `profiles` (con un `?user=<email>` como
   alternativa). Eso tenía dos problemas:

     · Era un escaneo de la tabla entera en cada visita.
     · Un mismo negocio podía tener varias instancias, así que la
       respuesta mezclaba los datos de una con los de otra.

   Ahora es `/agendar/<slug>`, con el slug del BOT. Es único en la base
   (restricción `bots_slug_key`), así que un enlace no puede apuntar a
   dos negocios, y el backend hace `where slug = ?` en vez de buscar.

   Como hay un solo bot por cliente, también desaparece el <select> de
   instancias que había: no hay nada que elegir.

   El teléfono pasa a ser OBLIGATORIO. Antes el backend lo aceptaba
   como NULL y la cita se creaba igual; ahora se rechaza sin él, porque
   una cita sin contacto no sirve: es la única forma de avisar del
   recordatorio.
   ========================================================= */

const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface Slot {
  time: string;
  display: string;
}

interface DayAvailability {
  date: string;
  slots: Slot[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_FULL[d.getDay()]}, ${d.getDate()}`;
}

export default function AgendaPublica() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [nombreNegocio, setNombreNegocio] = useState("");
  const [dias, setDias] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fechaElegida, setFechaElegida] = useState<string | null>(null);
  const [slotElegido, setSlotElegido] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [reservando, setReservando] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarAgenda = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/agenda?slug=${encodeURIComponent(slug)}`);
      const payload = await res.json();

      if (res.status === 404) {
        setError("Esta agenda no existe. Revisá el enlace que te pasaron.");
        setDias([]);
        return;
      }
      if (res.status === 429) {
        setError("Demasiadas consultas seguidas. Probá en un momento.");
        return;
      }
      if (payload.status === "success") {
        setNombreNegocio(payload.data.bot?.name || "");
        setDias(payload.data.days || []);
      } else {
        setError(payload.error || "No se pudo cargar la agenda.");
      }
    } catch {
      setError("No se pudo cargar la disponibilidad. Intentá más tarde.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    /* El setTimeout evita un aviso de estado sin montar: se dispara al
       montar el efecto, no durante el render. */
    const t = setTimeout(() => void cargarAgenda(), 0);
    return () => clearTimeout(t);
  }, [cargarAgenda]);

  const diaElegido = useMemo(
    () => dias.find((d) => d.date === fechaElegida) ?? null,
    [dias, fechaElegida]
  );

  async function reservar() {
    if (!slug || !fechaElegida || !slotElegido) return;

    /* El backend exige teléfono, así que se comprueba aquí para no
       gastar un viaje con un error que ya sabemos. */
    const digitos = telefono.replace(/\D/g, "");
    if (digitos.length < 7) {
      setAviso("Escribí un teléfono válido para poder avisarte.");
      return;
    }

    setReservando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          customerName: nombre || null,
          customerPhone: digitos,
          appointmentDate: fechaElegida,
          appointmentTime: slotElegido,
        }),
      });
      const payload = await res.json();

      if (payload.status === "success") {
        setHecho(true);
        return;
      }

      /* 409 = el hueco se acaba de ocupar. Es lo más probable cuando dos
         personas eligen a la vez, así que se recarga la agenda para que
         vean los huecos que quedan. */
      if (res.status === 409) {
        setAviso(payload.error || "Ese horario se acaba de ocupar.");
        setSlotElegido(null);
        await cargarAgenda();
        return;
      }
      if (res.status === 429) {
        setAviso("Demasiados intentos seguidos. Probá en un momento.");
        return;
      }
      setAviso(payload.error || "No se pudo reservar. Probá otro horario.");
      setSlotElegido(null);
      await cargarAgenda();
    } catch {
      setAviso("Error de conexión. Intentá de nuevo.");
    } finally {
      setReservando(false);
    }
  }

  /* ---------- estados ---------- */

  if (!slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-4">
        <p className="text-sm text-white/60">Link inválido. Contactá al negocio.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884]/15">
            <span className="text-xl">🗓️</span>
          </div>
          <h1 className="text-xl font-bold">
            {nombreNegocio ? `Turnos en ${nombreNegocio}` : "Agendá tu turno"}
          </h1>
          <p className="mt-1 text-sm text-white/60">Elegí día y horario disponible</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {hecho ? (
          <div className="rounded-2xl border border-[#00a884]/30 bg-[#00a884]/10 p-8 text-center">
            <CheckIcon className="mx-auto mb-3 h-10 w-10 text-[#00a884]" />
            <p className="text-lg font-semibold">¡Turno reservado!</p>
            <p className="mt-1 text-sm text-white/60">
              Te contactarán para confirmar. ¡Nos vemos!
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-white/30" />
          </div>
        ) : dias.length === 0 && !error ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-sm text-white/60">
              No hay disponibilidad en los próximos días.
            </p>
          </div>
        ) : fechaElegida ? (
          /* ---- elegir horario ---- */
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <button
              type="button"
              onClick={() => {
                setFechaElegida(null);
                setSlotElegido(null);
              }}
              className="mb-4 text-xs text-white/50 hover:text-white"
            >
              ← Volver a los días
            </button>

            <h2 className="text-base font-semibold">
              {diaElegido ? formatDate(diaElegido.date) : ""}
            </h2>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {diaElegido?.slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  onClick={() => {
                    setSlotElegido(s.time);
                    setAviso(null);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    slotElegido === s.time
                      ? "border-[#00a884] bg-[#00a884]/20 text-[#00a884]"
                      : "border-white/10 bg-white/5 text-white hover:border-white/30"
                  }`}
                >
                  {s.display}
                </button>
              ))}
            </div>

            {slotElegido && (
              <div className="mt-5 space-y-3 fade-up">
                <input
                  type="text"
                  placeholder="Tu nombre (opcional)"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#00a884] focus:outline-none"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Tu WhatsApp"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#00a884] focus:outline-none"
                />
                <p className="text-[11px] text-white/40">
                  Te avisamos por ahí si cambia algo.
                </p>

                {aviso && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
                    {aviso}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void reservar()}
                  disabled={reservando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {reservando ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {reservando ? "Reservando..." : "Confirmar turno"}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ---- lista de días ---- */
          <div className="space-y-3">
            {dias.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => {
                  setFechaElegida(d.date);
                  setSlotElegido(null);
                  setAviso(null);
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30"
              >
                <p className="text-sm font-semibold">{formatDate(d.date)}</p>
                <span className="shrink-0 rounded-full bg-[#00a884]/15 px-2.5 py-1 text-[10px] font-semibold text-[#00a884]">
                  {d.slots.length} horarios
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}