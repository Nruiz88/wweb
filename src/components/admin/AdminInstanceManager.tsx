"use client";

import { useState, useCallback, useEffect } from "react";
import type { Instance, Profile } from "@/lib/supabase/types";
import { CheckIcon, LoaderIcon, PlusIcon, TrashIcon, XIcon, MessageCircleIcon, ArrowRightIcon } from "@/components/icons";

interface Props {
  instances: Instance[];
  users: Profile[];
  onRefresh: () => void;
}

export default function AdminInstanceManager({ instances, users, onRefresh }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // After create: show assign prompt
  const [justCreated, setJustCreated] = useState<{ id: string; name: string } | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  async function handleCreate() {
    setCreating(true);
    setFeedback(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, evolutionApiUrl, evolutionApiKey }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `Instancia "${instanceName}" creada` });
        setJustCreated({ id: payload.data.id, name: payload.data.instance_name });
        setShowCreateForm(false);
        setInstanceName("");
        setEvolutionApiUrl("");
        setEvolutionApiKey("");
        onRefresh();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setCreating(false);
    }
  }

  async function handleTest() {
    if (!evolutionApiUrl || !evolutionApiKey) {
      setTestResult({ ok: false, message: "Completá URL y API key primero" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evolutionApiUrl, evolutionApiKey }),
      });
      const payload = await res.json();
      setTestResult({
        ok: payload.status === "success",
        message: payload.error || payload.message || "Error desconocido",
      });
    } catch {
      setTestResult({ ok: false, message: "Error de red al probar conexión" });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar instancia "${name}" y todas sus auto-respuestas?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/instances?id=${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `Instancia "${name}" eliminada` });
        onRefresh();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setDeleting(null);
    }
  }

  async function handleAssign() {
    if (!justCreated || !assignEmail) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: justCreated.id, userEmail: assignEmail }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: `"${justCreated.name}" asignada a ${assignEmail}` });
        setJustCreated(null);
        setAssignEmail("");
        onRefresh();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setAssigning(false);
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-wa-text">Instancias de WhatsApp</h3>
          <span className="rounded-full bg-[#00a884]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#00a884]">
            {instances.length} total
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreateForm(true); setJustCreated(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00a884] to-[#25d366] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Nueva instancia
        </button>
      </div>

      {/* Assign prompt (after creating) */}
      {justCreated && (
        <div className="mt-3 rounded-xl border border-[#00a884]/30 bg-[#00a884]/5 p-4 fade-up">
          <p className="text-xs font-semibold text-[#00a884]">
            ✅ Instancia &quot;{justCreated.name}&quot; creada
          </p>
          <p className="mt-1 text-[10px] text-wa-text-secondary/60">
            Asignala a un usuario para que pueda conectar WhatsApp
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="email"
              placeholder="email@usuario.com"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              className="flex-1 rounded-lg border border-wa-border bg-wa-input px-3 py-2 text-xs text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && void handleAssign()}
            />
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={assigning || !assignEmail}
              className="flex items-center gap-1.5 rounded-lg bg-[#00a884] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#00a884]/90 disabled:opacity-50"
            >
              {assigning ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <ArrowRightIcon className="h-3 w-3" />}
              Asignar
            </button>
            <button
              type="button"
              onClick={() => setJustCreated(null)}
              className="rounded-lg px-2 py-2 text-xs text-wa-text-secondary hover:bg-wa-hover"
            >
              Omitir
            </button>
          </div>
        </div>
      )}

      {/* Instance list */}
      <div className="mt-4 space-y-2">
        {instances.length === 0 ? (
          <div className="py-8 text-center">
            <MessageCircleIcon className="mx-auto h-10 w-10 text-wa-text-secondary/20" />
            <p className="mt-2 text-xs text-wa-text-secondary">No hay instancias creadas</p>
          </div>
        ) : (
          instances.map((inst) => {
            const isConnected = inst.status === "open";
            return (
              <div key={inst.id} className="group flex items-center gap-3 rounded-xl border border-wa-border/50 bg-wa-panel/50 px-4 py-3 transition-all hover:border-wa-border hover:bg-wa-panel">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${isConnected ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"}`}>
                  <MessageCircleIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-wa-text">{inst.instance_name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${isConnected ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[#00a884]" : "bg-red-400"}`} />
                      {isConnected ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-[10px] text-wa-text-secondary/50">
                    Creada: {new Date(inst.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(inst.id, inst.instance_name)}
                  disabled={deleting === inst.id}
                  className="shrink-0 rounded-lg p-2 text-red-400/50 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  title="Eliminar"
                >
                  {deleting === inst.id ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Create form modal */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <h3 className="text-base font-semibold text-wa-text">Nueva instancia</h3>
              <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg p-1 text-wa-text-secondary hover:text-wa-text">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">Nombre de instancia</label>
                <input type="text" placeholder="mi-whatsapp" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">URL de Evolution API</label>
                <input type="text" placeholder="https://your-api.railway.app" value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">API Key</label>
                <input type="password" placeholder="Tu API key de Evolution" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none" />
              </div>

              {/* Test connection */}
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#53bdeb]/40 bg-[#53bdeb]/10 py-2.5 text-xs font-semibold text-[#53bdeb] transition hover:bg-[#53bdeb]/20 disabled:opacity-50"
              >
                {testing ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}
                {testing ? "Probando..." : "Probar conexión"}
              </button>
              {testResult && (
                <div className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${testResult.ok ? "border-[#00a884]/30 bg-[#00a884]/10 text-[#00a884]" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover">Cancelar</button>
                <button type="button" onClick={() => void handleCreate()} disabled={creating || !instanceName || !evolutionApiUrl || !evolutionApiKey} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/20 transition-all hover:shadow-xl disabled:opacity-50">
                  {creating ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {creating ? "Creando..." : "Crear instancia"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
