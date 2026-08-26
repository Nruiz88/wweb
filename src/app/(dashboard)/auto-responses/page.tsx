"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutoResponse } from "@/lib/supabase/types";
import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
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
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-2.5">
        <span className="text-[0.9375rem] font-normal text-wa-text">Auto-Respuestas</span>
        <button
          type="button"
          onClick={openCreate}
          disabled={!instanceId}
          className="flex items-center gap-1.5 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Nueva
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
          feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884]" : "bg-red-500/10 text-red-400"
        }`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Content */}
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
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e6a44e]/10">
                <ZapIcon className="h-8 w-8 text-[#e6a44e]" />
              </div>
              <div>
                <p className="text-base font-semibold text-wa-text">Crea tu primera respuesta</p>
                <p className="mt-1 max-w-xs text-sm text-wa-text-secondary">
                  Cuando alguien escriba estas palabras, tu bot respondera solo
                </p>
              </div>
            </div>

            {/* Quick templates */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-wa-text-secondary/60">Ejemplos rapidos</p>
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
                  className="w-full rounded-xl border border-wa-border bg-wa-header p-3 text-left transition hover:border-[#e6a44e]/40 hover:bg-wa-hover"
                >
                  <p className="text-[10px] text-wa-text-secondary/60">cuando alguien escriba</p>
                  <p className="text-sm font-medium text-wa-text">{t.keyword}</p>
                  <p className="mt-1 text-[10px] text-wa-text-secondary/60">responde</p>
                  <p className="text-xs text-wa-text-secondary line-clamp-1">{t.response}</p>
                </button>
              ))}
            </div>

            {/* Or create custom */}
            <button
              type="button"
              onClick={openCreate}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-wa-border bg-wa-header px-4 py-3 text-sm text-wa-text-secondary hover:border-[#00a884]/40 hover:text-[#00a884]"
            >
              <PlusIcon className="h-4 w-4" />
              Crear respuesta personalizada
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map((r) => (
              <div key={r.id} className="rounded-2xl border border-wa-border bg-wa-header p-4 transition hover:border-wa-text-secondary/20">
                {/* Chat preview */}
                <div className="mb-3 flex items-end gap-2">
                  <div className="max-w-[70%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2">
                    <p className="text-xs text-wa-text">{r.keyword || r.regex_pattern}</p>
                  </div>
                  <div className="max-w-[70%] rounded-lg rounded-tr-none bg-[#005c4b] px-3 py-2">
                    <p className="text-xs text-wa-text line-clamp-2">{r.response_text}</p>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggle(r)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        r.is_active ? "bg-[#00a884]" : "bg-wa-text-secondary/30"
                      }`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        r.is_active ? "translate-x-4" : "translate-x-0.5"
                      }`} />
                    </button>
                    <span className="text-[10px] text-wa-text-secondary/60">
                      {r.is_active ? "Activa" : "Pausada"}
                    </span>
                    {r.schedule?.from && r.schedule?.to && (
                      <span className="rounded-full bg-[#e6a44e]/15 px-2 py-0.5 text-[10px] font-medium text-[#e6a44e]">
                        Horario {r.schedule.from}-{r.schedule.to}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded-lg px-3 py-1.5 text-xs text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      className="rounded-lg px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <h3 className="text-base font-semibold text-wa-text">
                {editingResponse ? "Editar respuesta" : "Nueva respuesta"}
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Preview chat */}
            <div className="border-b border-wa-border bg-[#0b141a] px-5 py-4">
              <p className="mb-3 text-center text-[10px] text-wa-text-secondary/50">Asi se veria la conversacion</p>
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
            <div className="flex flex-col gap-4 p-5">
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
                  Tu bot respondra...
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
