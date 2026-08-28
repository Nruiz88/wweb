"use client";

import { useCallback, useEffect, useState } from "react";
import type { Instance, Profile } from "@/lib/supabase/types";
import {
  CheckIcon,
  LoaderIcon,
  PlusIcon,
  SettingsIcon,
  ShieldIcon,
  TrashIcon,
  XIcon,
  MessageCircleIcon,
  ZapIcon,
} from "@/components/icons";

// Instance card
function InstanceCard({ instance, onDelete }: { instance: Instance; onDelete: (id: string) => void }) {
  const isConnected = instance.status === "open";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-4 transition-all hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10 blur-xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: isConnected ? "#00a884" : "#ef4444" }} />
      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
            isConnected ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"
          }`}>
            <MessageCircleIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-wa-text">{instance.instance_name}</h3>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isConnected
                  ? "bg-[#00a884]/15 text-[#00a884]"
                  : "bg-red-500/15 text-red-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[#00a884]" : "bg-red-400"}`} />
                {isConnected ? "Conectada" : "Desconectada"}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-wa-text-secondary/50">
              Creada: {new Date(instance.created_at).toLocaleDateString("es-AR")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(instance.id)}
          className="shrink-0 rounded-lg p-2 text-red-400/50 transition-all hover:bg-red-500/10 hover:text-red-400"
          title="Eliminar"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [instanceName, setInstanceName] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");

  // Welcome / outside-hours settings
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [outsideHoursMessage, setOutsideHoursMessage] = useState("");
  const [savingMessages, setSavingMessages] = useState(false);

  const isAdmin = profile?.role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/instances");
    const payload = await res.json();
    if (payload.status === "success") {
      setInstances(payload.data);
      if (payload.role) {
        setProfile({ id: "", email: null, full_name: null, role: payload.role, business_name: null, phone: null, address: null, created_at: "" });
      }
      // Load settings for first instance
      if (payload.data?.length > 0) {
        const id = payload.data[0].id;
        setSelectedInstanceId(id);
        try {
          const settingsRes = await fetch(`/api/instance-settings?instanceId=${id}`);
          const settingsPayload = await settingsRes.json();
          if (settingsPayload.status === "success") {
            setWelcomeMessage(settingsPayload.data.welcomeMessage || "");
            setOutsideHoursMessage(settingsPayload.data.outsideHoursMessage || "");
          }
        } catch { /* non-critical */ }
      }
    }
    setLoading(false);
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

  async function handleCreate() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, evolutionApiUrl, evolutionApiKey }),
      });
      const payload = await res.json();
      if (payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error });
        return;
      }
      setFeedback({ kind: "success", message: "Servidor creado correctamente" });
      setShowForm(false);
      setInstanceName("");
      setEvolutionApiUrl("");
      setEvolutionApiKey("");
      await loadData();
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este servidor y todas sus auto-respuestas?")) return;
    const res = await fetch(`/api/instances?id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.status === "success") await loadData();
  }

  async function handleSaveMessages() {
    if (!selectedInstanceId) return;
    setSavingMessages(true);
    try {
      const res = await fetch("/api/instance-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          welcomeMessage: welcomeMessage || null,
          outsideHoursMessage: outsideHoursMessage || null,
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: "Mensajes guardados" });
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSavingMessages(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-normal text-wa-text">Configuracion</span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#00a884]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00a884]">
              <ShieldIcon className="h-2.5 w-2.5" /> Admin
            </span>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00a884] to-[#25d366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#00a884]/20 transition-all hover:shadow-md hover:shadow-[#00a884]/30"
          >
            <PlusIcon className="h-3.5 w-3.5" />
Nuevo servidor
          </button>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${
          feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-wa-header ring-4 ring-wa-border/30">
              <SettingsIcon className="h-10 w-10 text-wa-text-secondary/20" />
            </div>
            <div>
              <p className="text-base font-semibold text-wa-text">
                {isAdmin ? "Sin servidores" : "Sin servidor asignado"}
              </p>
              <p className="mt-1 text-sm text-wa-text-secondary">
                {isAdmin ? "Crea una para que los usuarios conecten WhatsApp" : "Pide al administrador que te asigne una"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Welcome + Outside-hours messages */}
        {selectedInstanceId && instances.length > 0 && (
          <div className="mt-6 rounded-2xl border border-wa-border bg-wa-header p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e6a44e]/15 text-[#e6a44e]">
                <ZapIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-wa-text">Mensajes automáticos</p>
                <p className="text-[10px] text-wa-text-secondary/60">Bienvenida y fuera de horario</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Mensaje de bienvenida
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: ¡Hola! 👋 Bienvenido a [tu negocio]. ¿En qué te puedo ayudar?"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="resize-none rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
                <p className="text-[10px] text-wa-text-secondary/50">
                  Se envía solo la primera vez que cada persona te escribe
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Mensaje fuera de horario
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: ¡Hola! Nuestro horario es de lunes a viernes de 9:00 a 18:00. Te responderemos al día siguiente."
                  value={outsideHoursMessage}
                  onChange={(e) => setOutsideHoursMessage(e.target.value)}
                  className="resize-none rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
                <p className="text-[10px] text-wa-text-secondary/50">
                  Se envía cuando escriben fuera del horario configurado en{' '}
                  <a href="/calendar" className="text-[#00a884] hover:underline">Calendario</a>
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleSaveMessages()}
                disabled={savingMessages}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#00a884]/90 disabled:opacity-50"
              >
                {savingMessages ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : null}
                {savingMessages ? "Guardando..." : "Guardar mensajes"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <h3 className="text-base font-semibold text-wa-text">Nuevo servidor</h3>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-wa-text-secondary hover:text-wa-text">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">Nombre de servidor</label>
                <input type="text" placeholder="mi-whatsapp" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">URL de Evolution API</label>
                <input type="url" placeholder="https://your-api.railway.app" value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">API Key</label>
                <input type="password" placeholder="Tu API key de Evolution" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover transition">Cancelar</button>
                <button type="button" onClick={() => void handleCreate()} disabled={saving || !instanceName || !evolutionApiUrl || !evolutionApiKey} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/20 transition-all hover:shadow-xl disabled:opacity-50">
                  {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Creando..." : "Crear servidor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
