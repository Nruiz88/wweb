"use client";

import { useState, useEffect } from "react";
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
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
      {/* Feedback */}
      {feedback && (
        <div className={`mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-semibold backdrop-blur-sm transition-all duration-300 ${feedback.kind === "success" ? "bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/20" : "bg-red-500/15 text-red-400 border border-red-500/20"}`}>
          {feedback.kind === "success" ? <CheckIcon className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5">
            <MessageCircleIcon className="h-4.5 w-4.5 text-[#00a884]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-wa-text tracking-tight">Instancias de WhatsApp</h3>
            <span className="text-[10px] text-wa-text-secondary/60">{instances.length} total</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreateForm(true); setJustCreated(null); }}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#00a884]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#00a884]/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Nueva instancia
        </button>
      </div>

      {/* Assign prompt */}
      {justCreated && (
        <div className="mt-4 rounded-2xl border border-[#00a884]/30 bg-[#00a884]/5 p-4 backdrop-blur-sm">
          <p className="text-xs font-bold text-[#00a884]">
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
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all"
              onKeyDown={(e) => e.key === "Enter" && void handleAssign()}
            />
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={assigning || !assignEmail}
              className="flex items-center gap-1.5 rounded-xl bg-[#00a884] px-3.5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#00a884]/20 transition-all hover:bg-[#00a884]/90 hover:shadow-lg disabled:opacity-50"
            >
              {assigning ? <LoaderIcon className="h-3 w-3 animate-spin" /> : <ArrowRightIcon className="h-3 w-3" />}
              Asignar
            </button>
            <button
              type="button"
              onClick={() => setJustCreated(null)}
              className="rounded-xl px-3 py-2.5 text-xs text-wa-text-secondary hover:bg-white/5 transition-all"
            >
              Omitir
            </button>
          </div>
        </div>
      )}

      {/* Instance list */}
      <div className="mt-4 space-y-2.5">
        {instances.length === 0 ? (
          <div className="py-10 text-center">
            <MessageCircleIcon className="mx-auto h-12 w-12 text-wa-text-secondary/15" />
            <p className="mt-3 text-xs text-wa-text-secondary/50 font-medium">No hay instancias creadas</p>
          </div>
        ) : (
          instances.map((inst) => {
            const isConnected = inst.status === "open";
            return (
              <div key={inst.id} className="group flex items-center gap-3.5 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3.5 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/10">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${isConnected ? "bg-[#00a884]/15 text-[#00a884] shadow-lg shadow-[#00a884]/10" : "bg-red-500/15 text-red-400"}`}>
                  <MessageCircleIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="truncate text-sm font-bold text-wa-text">{inst.instance_name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isConnected ? "bg-[#00a884]/15 text-[#00a884]" : "bg-red-500/15 text-red-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[#00a884] animate-pulse" : "bg-red-400"}`} />
                      {isConnected ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-wa-text-secondary/40">
                    Creada: {new Date(inst.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(inst.id, inst.instance_name)}
                  disabled={deleting === inst.id}
                  className="shrink-0 rounded-xl p-2.5 text-red-400/40 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 hover:scale-110 disabled:opacity-50"
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
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-wa-header to-wa-panel shadow-2xl shadow-black/30 fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-wa-header to-wa-header/80 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-wa-text tracking-tight">Nueva instancia</h3>
                <p className="text-[10px] text-wa-text-secondary/50 mt-0.5">Conecta un nuevo bot de WhatsApp</p>
              </div>
              <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-xl p-2 text-wa-text-secondary hover:text-wa-text hover:bg-white/5 transition-all">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-wa-text-secondary uppercase tracking-wider">Nombre de instancia</label>
                <input type="text" placeholder="mi-whatsapp" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-wa-text-secondary uppercase tracking-wider">URL de Evolution API</label>
                <input type="text" placeholder="https://your-api.railway.app" value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-wa-text-secondary uppercase tracking-wider">API Key</label>
                <input type="password" placeholder="Tu API key de Evolution" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 transition-all" />
              </div>

              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#53bdeb]/30 bg-[#53bdeb]/10 py-2.5 text-xs font-bold text-[#53bdeb] transition-all duration-200 hover:bg-[#53bdeb]/20 hover:shadow-md hover:shadow-[#53bdeb]/10 disabled:opacity-50"
              >
                {testing ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckIcon className="h-3.5 w-3.5" />}
                {testing ? "Probando..." : "Probar conexión"}
              </button>
              {testResult && (
                <div className={`rounded-xl border px-4 py-2.5 text-xs font-semibold backdrop-blur-sm ${testResult.ok ? "border-[#00a884]/30 bg-[#00a884]/10 text-[#00a884]" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-semibold text-wa-text-secondary hover:bg-white/5 transition-all">Cancelar</button>
                <button type="button" onClick={() => void handleCreate()} disabled={creating || !instanceName || !evolutionApiUrl || !evolutionApiKey} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] py-3 text-sm font-bold text-white shadow-lg shadow-[#00a884]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#00a884]/30 hover:scale-[1.01] disabled:opacity-50">
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
