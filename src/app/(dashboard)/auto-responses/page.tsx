"use client";
import { useCallback, useEffect, useState } from "react";
import type { AutoResponse } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, Trash2, Pencil, X, Eye, EyeOff, Sparkles } from "lucide-react";

export default function AutoResponsesPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [responses, setResponses] = useState<AutoResponse[]>([]);
  // loading derivado: true hasta que los datos se cargan para el instanceId actual
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutoResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search] = useState("");
  const [keyword, setKeyword] = useState("");
  const [regexPattern, setRegexPattern] = useState("");
  const [responseText, setResponseText] = useState("");
  const [responseType, setResponseType] = useState<"text" | "menu">("text");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!instanceId) return;
    const res = await fetch(`/api/auto-responses?instanceId=${instanceId}`);
    const p = await res.json();
    if (p.status === "success") setResponses(p.data);
  }, [instanceId]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/instances?lite=1");
      const j = await r.json();
      if (j.status === "success" && j.data?.[0]) setInstanceId(j.data[0].id);
    })();
  }, []);
  useEffect(() => {
    if (!instanceId || loadedFor === instanceId) return;
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoadedFor(instanceId);
    })();
    return () => { cancelled = true; };
  }, [instanceId, load, loadedFor]);
  const loading = instanceId ? loadedFor !== instanceId : true;

  const filteredResponses = responses.filter(
    (r) =>
      r.keyword?.toLowerCase().includes(search.toLowerCase()) ||
      r.regex_pattern?.toLowerCase().includes(search.toLowerCase()) ||
      r.response_text.toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(r: AutoResponse) {
    setEditing(r);
    setKeyword(r.keyword || "");
    setRegexPattern(r.regex_pattern || "");
    setResponseText(r.response_text);
    setResponseType(r.response_type);
    setIsActive(r.is_active);
    setShowForm(true);
  }

  function resetForm() { setEditing(null); setShowForm(false); setKeyword(""); setRegexPattern(""); setResponseText(""); setResponseType("text"); setIsActive(true); }

  async function onSubmit() {
    try {
      const body = editing ? { id: editing.id, keyword: keyword || undefined, regex_pattern: regexPattern || undefined, response_text: responseText, response_type: responseType, is_active: isActive } : { instanceId, keyword: keyword || undefined, regex_pattern: regexPattern || undefined, response_text: responseText, response_type: responseType, is_active: isActive };
      const res = await fetch("/api/auto-responses", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const p = await res.json();
      if (p.status === "success") { toast.success(editing ? "Actualizado" : "Agregado"); resetForm(); load(); }
      else toast.error(p.error || "Error");
    } catch { toast.error("Error inesperado"); }
  }

  async function toggle(id: string) {
    const r = responses.find(x => x.id === id); if (!r) return;
    await fetch("/api/auto-responses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active: !r.is_active }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta respuesta automática?")) return;
    await fetch(`/api/auto-responses?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25">
              <Zap className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Auto-Respuestas</h1>
            <p className="text-xs text-slate-400 mt-0.5">Palabras clave o regex que responden automáticamente · <span className="text-cyan-400 font-semibold">{responses.filter(r => r.is_active).length} activas</span></p>
          </div>
          {!editing && !showForm && (
            <Button onClick={() => setShowForm(true)} className="h-10 rounded-xl gap-1.5 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-400/40">
              <Plus className="h-4 w-4" strokeWidth={2.5} />Nueva
            </Button>
          )}
        </div>
      </div>

      {/* Formulario inline */}
      <AnimatePresence>
        {(editing || showForm) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-3">
              <div className="rounded-2xl border-2 border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.06] to-transparent p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <p className="text-sm font-semibold text-slate-100">{editing ? "Editar respuesta" : "Nueva respuesta"}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7 text-slate-400 hover:text-slate-200"><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                  <Input placeholder="Palabra clave" value={keyword} onChange={e => setKeyword(e.target.value)} className="h-8 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500" />
                  <Input placeholder="Regex (opcional)" value={regexPattern} onChange={e => setRegexPattern(e.target.value)} className="h-8 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500" />
                </div>
                <Input placeholder="Texto de respuesta" value={responseText} onChange={e => setResponseText(e.target.value)} className="h-8 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-2" />
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-300">Tipo:</span>
                  <Button variant={responseType === "text" ? "outline" : "default"} size="sm" onClick={() => setResponseType("text")} className="h-8 text-xs">Texto</Button>
                  <Button variant={responseType === "menu" ? "outline" : "default"} size="sm" onClick={() => setResponseType("menu")} className="h-8 text-xs">Menú</Button>
                </div>
                {responseType === "menu" && <div className="p-2 bg-cyan-500/[0.06] rounded-xl text-xs text-cyan-200 mb-2">Configura el menú en <a href="/menus" className="underline hover:text-cyan-300">Menús interactivos</a></div>}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-xs text-slate-300">Cancelar</Button>
                  <Button onClick={onSubmit} size="sm" className="h-8 text-xs bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-semibold">Guardar</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />)}
          </div>
        ) : filteredResponses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/[0.06] p-12 text-center">
            <Zap className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{search ? "Sin resultados" : "Sin respuestas aún"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredResponses.map((r, idx) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Card className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md overflow-hidden shadow-xl shadow-black/30 hover:border-white/[0.12] transition-all">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Respuesta #{idx + 1}</p>
                        <p className="text-sm font-medium truncate text-slate-200">{r.keyword || r.regex_pattern || "Sin keyword"}</p>
                      </div>
                      <Badge variant={r.is_active ? "default" : "secondary"} className={r.is_active ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px]" : "bg-rose-400/10 text-rose-400 border-rose-400/20 text-[10px]"}>
                        {r.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-sm text-slate-200 break-all leading-relaxed">{r.response_text}</p>
                      {r.menu_config && r.menu_config.buttons && r.menu_config.buttons.length > 0 && (
                        <div className="p-2.5 bg-cyan-500/[0.04] rounded-xl border border-cyan-400/10">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400 mb-1.5">Botones</p>
                          <div className="flex flex-wrap gap-1.5">
                            {r.menu_config.buttons.map(b => (
                              <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">{b.text}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 pt-2 text-[10px] text-slate-500">
                        {r.keyword && <span>Keyword</span>}
                        {r.regex_pattern && <span>Regex</span>}
                        <span className="ml-auto">Tipo: <span className="text-slate-300 font-medium">{r.response_type}</span></span>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/[0.06] flex gap-1 bg-white/[0.01]">
                      {editing?.id === r.id ? (
                        <>
                          <Button onClick={onSubmit} size="sm" className="h-7 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs gap-1"><Pencil className="h-3 w-3" />Guardar</Button>
                          <Button variant="ghost" size="sm" onClick={resetForm} className="h-7 text-xs text-slate-300">Cancelar</Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(r)} className="h-7 w-7 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10" title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle(r.id)} className="h-7 w-7 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10" title={r.is_active ? "Pausar" : "Activar"}>{r.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10" onClick={() => remove(r.id)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}