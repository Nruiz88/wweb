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
} from "@/components/icons";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Form state
  const [instanceName, setInstanceName] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");

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
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

      setFeedback({ kind: "success", message: "Instancia creada correctamente" });
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
    if (!confirm("¿Eliminar esta instancia y todas sus auto-respuestas?")) return;

    const res = await fetch(`/api/instances?id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.status === "success") {
      await loadData();
    }
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-2.5">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-5 w-5 text-[#00a884]" />
          <span className="text-[0.9375rem] font-normal text-wa-text">Configuración</span>
          {profile && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isAdmin ? "bg-[#00a884]/15 text-[#00a884]" : "bg-[#53bdeb]/15 text-[#53bdeb]"
            }`}>
              {isAdmin ? "Admin" : "Usuario"}
            </span>
          )}
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00a884]/90"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Nueva instancia
          </button>
        )}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <SettingsIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">
              {isAdmin ? "Sin instancias configuradas" : "No tienes instancias asignadas"}
            </p>
            <p className="text-xs text-wa-text-secondary/60">
              {isAdmin
                ? "Crea una instancia para que los usuarios puedan conectar WhatsApp"
                : "Pide al administrador que te asigne una instancia"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="rounded-xl border border-wa-border bg-wa-header p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-wa-text">{instance.instance_name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          instance.status === "open"
                            ? "bg-[#00a884]/15 text-[#00a884]"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {instance.status === "open" ? "Conectada" : "Desconectada"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-wa-text-secondary/50">
                      Creada: {new Date(instance.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(instance.id)}
                        className="icon-btn h-8 w-8 text-red-400 hover:text-red-300"
                        title="Eliminar"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Instance Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-panel fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-wa-text">Nueva instancia</h3>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Nombre de instancia</label>
                <input
                  type="text"
                  placeholder="mi-whatsapp"
                  value={instanceName}
                  onChange={(event) => setInstanceName(event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">URL de Evolution API</label>
                <input
                  type="url"
                  placeholder="https://your-api.railway.app"
                  value={evolutionApiUrl}
                  onChange={(event) => setEvolutionApiUrl(event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">API Key</label>
                <input
                  type="password"
                  placeholder="Tu API key de Evolution"
                  value={evolutionApiKey}
                  onChange={(event) => setEvolutionApiKey(event.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-wa-border px-4 py-2.5 text-sm text-wa-text-secondary hover:bg-wa-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={saving || !instanceName || !evolutionApiUrl || !evolutionApiKey}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50"
                >
                  {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Creando..." : "Crear instancia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
