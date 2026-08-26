"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AutoResponse } from "@/lib/supabase/types";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  PenIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
  ZapIcon,
} from "@/components/icons";

const quickTemplates = [
  { keyword: "horario", response: "Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sabados de 9:00 a 14:00." },
  { keyword: "precio", response: "Nuestros precios van desde $10.000. Escribe tu consulta y te atendemos." },
  { keyword: "direccion", response: "Nos encontramos en Av. Principal 1234, Ciudad. Te esperamos!" },
  { keyword: "gracias", response: "Gracias a ti! Si necesitas algo mas, escribeme. 😊" },
];

export default function AutoResponsesPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResponse, setEditingResponse] = useState<AutoResponse | null>(null);
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // Simple form state
  const [keyword, setKeyword] = useState("");
  const [responseText, setResponseText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrom, setScheduleFrom] = useState("09:00");
  const [scheduleTo, setScheduleTo] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const instRes = await fetch("/api/instances");
      const instPayload = await instRes.json();

      if (instPayload.status === "success" && instPayload.data?.length > 0) {
        const id = instPayload.data[0].id;
        setInstanceId(id);

        const arRes = await fetch(`/api/auto-responses?instanceId=${id}`);
        const arPayload = await arRes.json();
        if (arPayload.status === "success") {
          setResponses(arPayload.data);
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

  const filteredResponses = useMemo(() => {
    let list = responses;
    if (onlyActive) list = list.filter((r) => r.is_active);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.keyword?.toLowerCase().includes(q) ||
          r.response_text.toLowerCase().includes(q)
      );
    }
    return list;
  }, [responses, onlyActive, search]);

  const activeCount = useMemo(() => responses.filter((r) => r.is_active).length, [responses]);

  function openCreate() {
    setKeyword("");
    setResponseText("");
    setIsActive(true);
    setScheduleEnabled(false);
    setScheduleFrom("09:00");
    setScheduleTo("18:00");
    setEditingResponse(null);
    setShowForm(true);
  }

  function openEdit(r: AutoResponse) {
    setEditingResponse(r);
    setKeyword(r.keyword || "");
    setResponseText(r.response_text);
    setIsActive(r.is_active);
    setScheduleEnabled(Boolean(r.schedule?.from && r.schedule?.to));
    setScheduleFrom(r.schedule?.from || "09:00");
    setScheduleTo(r.schedule?.to || "18:00");
    setShowForm(true);
  }

  async function handleSave() {
    if (!keyword || !responseText) return;
    setSaving(true);
    setFeedback(null);

    try {
      const schedule = scheduleEnabled && scheduleFrom && scheduleTo
        ? { from: scheduleFrom, to: scheduleTo }
        : null;

      const method = editingResponse ? "PUT" : "POST";
      const body = editingResponse
        ? { id: editingResponse.id, keyword, responseText, isActive, schedule }
        : { instanceId, keyword, responseText, isActive, schedule };

      const res = await fetch("/api/auto-responses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await res.json();
      if (payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error });
        return;
      }

      setFeedback({ kind: "success", message: editingResponse ? "Regla actualizada" : "Regla creada" });
      setShowForm(false);
      await loadData();
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta regla?")) return;
    setFeedback({ kind: "success", message: "Regla eliminada" });
    await fetch(`/api/auto-responses?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleToggle(r: AutoResponse) {
    await fetch("/api/auto-responses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, isActive: !r.is_active }),
    });
    await loadData();
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
            <ZapIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Auto-Respuestas</p>
            <p className="text-[10px] text-wa-text-secondary/60">
              {responses.length > 0
                ? `${responses.length} regla${responses.length !== 1 ? "s" : ""} · ${activeCount} activa${activeCount !== 1 ? "s" : ""}`
                : "Configura tu bot"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!instanceId}
          className="flex items-center gap-1.5 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-[#00a884]/20 transition hover:bg-[#00a884]/90 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Nueva respuesta
        </button>
      </div>

      {/* ===== Feedback ===== */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs fade-up ${
          feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884]" : "bg-red-500/10 text-red-400"
        }`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* ===== Content ===== */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!instanceId ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ZapIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">Espera a que el administrador te asigne una instancia</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : responses.length === 0 ? (
          /* ===== Empty state ===== */
          <div className="mx-auto max-w-2xl space-y-6 py-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-[#e6a44e]/10 blur-xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6a44e]/20 to-[#e6a44e]/5 ring-4 ring-[#e6a44e]/10">
                  <ZapIcon className="h-9 w-9 text-[#e6a44e]" />
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-wa-text">Crea tu primera respuesta</p>
                <p className="mt-1 max-w-xs text-sm text-wa-text-secondary">
                  Cuando alguien escriba estas palabras, tu bot respondera solo
                </p>
              </div>
            </div>

            {/* Quick templates */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-wa-text-secondary/60">Empieza con una plantilla</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {quickTemplates.map((t) => (
                  <button
                    key={t.keyword}
                    type="button"
                    onClick={() => {
                      setKeyword(t.keyword);
                      setResponseText(t.response);
                      setEditingResponse(null);
                      setShowForm(true);
                    }}
                    className="group rounded-xl border border-wa-border bg-wa-header p-4 text-left transition hover:border-[#e6a44e]/40 hover:bg-wa-hover"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-wa-text">&quot;{t.keyword}&quot;</p>
                      <span className="rounded-full bg-[#e6a44e]/15 px-2 py-0.5 text-[9px] font-medium text-[#e6a44e]">
                        plantilla
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-wa-text-secondary line-clamp-2">{t.response}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Or create custom */}
            <button
              type="button"
              onClick={openCreate}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-wa-border bg-wa-header px-4 py-3 text-sm text-wa-text-secondary transition hover:border-[#00a884]/40 hover:text-[#00a884]"
            >
              <PlusIcon className="h-4 w-4" />
              Crear respuesta personalizada
            </button>
          </div>
        ) : (
          /* ===== Rules list ===== */
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Toolbar: search + filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wa-text-secondary/50" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por palabra clave o respuesta..."
                  className="w-full rounded-xl border border-wa-border bg-wa-header py-2.5 pl-9 pr-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyActive(!onlyActive)}
                className={`flex shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition ${
                  onlyActive
                    ? "border-[#00a884]/40 bg-[#00a884]/10 text-[#00a884]"
                    : "border-wa-border bg-wa-header text-wa-text-secondary hover:bg-wa-hover"
                }`}
              >
                <span className={`relative flex h-2 w-2 ${onlyActive ? "" : "opacity-40"}`}>
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-[#00a884] ${onlyActive ? "animate-ping opacity-75" : ""}`} />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                </span>
                Solo activas
              </button>
            </div>

            {filteredResponses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-wa-border bg-wa-header p-10 text-center">
                <p className="text-sm text-wa-text-secondary">No hay reglas que coincidan con tu busqueda</p>
              </div>
            ) : (
              filteredResponses.map((r) => (
                <div
                  key={r.id}
                  className="group overflow-hidden rounded-2xl border border-wa-border bg-wa-header transition hover:border-wa-text-secondary/20 hover:shadow-lg hover:shadow-black/20"
                >
                  {/* Card header */}
                  <div className="flex items-center gap-3 border-b border-wa-border/50 px-4 py-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        r.is_active
                          ? "bg-gradient-to-br from-[#00a884]/25 to-[#00a884]/5 text-[#00a884]"
                          : "bg-wa-text-secondary/10 text-wa-text-secondary/60"
                      }`}
                    >
                      {r.keyword?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-wa-text">
                        cuando escriban <span className="text-[#e6a44e]">&quot;{r.keyword || r.regex_pattern}&quot;</span>
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium ${
                            r.is_active ? "bg-[#00a884]/15 text-[#00a884]" : "bg-wa-text-secondary/10 text-wa-text-secondary/60"
                          }`}
                        >
                          {r.is_active ? "Activa" : "Pausada"}
                        </span>
                        {r.schedule?.from && r.schedule?.to && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e6a44e]/15 px-2 py-0.5 text-[9px] font-medium text-[#e6a44e]">
                            <ClockIcon className="h-2.5 w-2.5" />
                            {r.schedule.from} - {r.schedule.to}
                          </span>
                        )}
                        {r.regex_pattern && (
                          <span className="inline-flex items-center rounded-full bg-[#53bdeb]/15 px-2 py-0.5 text-[9px] font-medium text-[#53bdeb]">
                            regex
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggle(r)}
                      aria-label={r.is_active ? "Pausar" : "Activar"}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        r.is_active ? "bg-[#00a884]" : "bg-wa-text-secondary/30"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        r.is_active ? "translate-x-5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  {/* Chat preview */}
                  <div className="bg-[#0b141a] px-4 py-3.5">
                    <div className="flex items-end gap-2">
                      <div className="max-w-[45%] rounded-xl rounded-bl-sm bg-[#202c33] px-3 py-2 shadow-sm">
                        <p className="text-xs leading-relaxed text-wa-text">{r.keyword || r.regex_pattern}</p>
                      </div>
                      <div className="max-w-[55%] rounded-xl rounded-br-sm bg-[#005c4b] px-3 py-2 shadow-sm">
                        <p className="text-xs leading-relaxed text-wa-text line-clamp-3">{r.response_text}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card footer: actions */}
                  <div className="flex items-center justify-end gap-1 border-t border-wa-border/50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                    >
                      <PenIcon className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400/80 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ===== Modal ===== */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-wa-text">
                  {editingResponse ? "Editar respuesta" : "Nueva respuesta"}
                </h3>
                <p className="text-[10px] text-wa-text-secondary/60">
                  {editingResponse ? "Modifica como reacciona tu bot" : "Enseñale a tu bot que responder"}
                </p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Preview chat */}
            <div className="border-b border-wa-border bg-[#0b141a] px-5 py-4">
              <p className="mb-3 text-center text-[10px] uppercase tracking-wide text-wa-text-secondary/50">Asi se veria</p>
              <div className="space-y-2">
                {/* Incoming message */}
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2">
                    <p className="text-sm text-wa-text">
                      {keyword || <span className="text-wa-text-secondary/40 italic">palabra clave</span>}
                    </p>
                  </div>
                </div>
                {/* Bot response */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2">
                    <p className="text-sm text-wa-text">
                      {responseText || <span className="text-white/40 italic">tu respuesta</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {/* Keyword */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Cuando alguien escriba...
                </label>
                <input
                  type="text"
                  placeholder='Ej: "precio", "horario", "direccion"'
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
                <p className="text-[10px] text-wa-text-secondary/50">
                  La palabra aparecera en cualquier parte del mensaje
                </p>
              </div>

              {/* Response */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Tu bot respondera...
                </label>
                <textarea
                  rows={3}
                  placeholder='Ej: "Hola! Nuestros precios van desde $10.000. En que te puedo ayudar?"'
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="resize-none rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-2 rounded-xl border border-wa-border bg-wa-input px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-wa-text">Horario de activacion</span>
                  <button
                    type="button"
                    onClick={() => setScheduleEnabled(!scheduleEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${scheduleEnabled ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>

                {scheduleEnabled && (
                  <div className="fade-up flex items-center gap-3">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] text-wa-text-secondary/60">Desde</span>
                      <input
                        type="time"
                        value={scheduleFrom}
                        onChange={(e) => setScheduleFrom(e.target.value)}
                        className="rounded-lg border border-wa-border bg-wa-panel px-3 py-2 text-sm text-wa-text focus:border-[#00a884] focus:outline-none"
                      />
                    </label>
                    <span className="mt-4 text-wa-text-secondary/50">a</span>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] text-wa-text-secondary/60">Hasta</span>
                      <input
                        type="time"
                        value={scheduleTo}
                        onChange={(e) => setScheduleTo(e.target.value)}
                        className="rounded-lg border border-wa-border bg-wa-panel px-3 py-2 text-sm text-wa-text focus:border-[#00a884] focus:outline-none"
                      />
                    </label>
                  </div>
                )}
                <p className="text-[10px] text-wa-text-secondary/50">
                  Si lo activas, la regla solo respondera dentro de esa franja horaria
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-xl border border-wa-border bg-wa-input px-4 py-3">
                <span className="text-sm text-wa-text">Activar ahora</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isActive ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || !keyword || !responseText}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Guardando..." : "Guardar respuesta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}