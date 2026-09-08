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
import { Plus, Trash2, Pencil, X, Eye, EyeOff, Layers, Menu } from "lucide-react";

export default function MenusPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [menus, setMenus] = useState<AutoResponse[]>([]);
  // loading derivado: true hasta que los datos se cargan para el instanceId actual
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutoResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    if (!instanceId) return;
    const res = await fetch(`/api/auto-responses?instanceId=${instanceId}&type=menu`);
    const p = await res.json();
    if (p.status === "success") setMenus(p.data);
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

  const filteredMenus = menus.filter(
    (m) =>
      m.menu_config?.title?.toLowerCase().includes(search.toLowerCase()) ||
      m.menu_config?.description?.toLowerCase().includes(search.toLowerCase()) ||
      m.menu_config?.buttons?.some(b => b.text.toLowerCase().includes(search.toLowerCase()))
  );

  function startEdit(m: AutoResponse) {
    setEditing(m);
    setTitle(m.menu_config?.title || "");
    setDescription(m.menu_config?.description || "");
    setIsActive(m.is_active);
    setShowForm(true);
  }

  function resetForm() {
    setEditing(null); setShowForm(false);
    setTitle(""); setDescription(""); setIsActive(true);
  }

  async function onSubmit() {
    try {
      const body = editing
        ? { id: editing.id, menu_config: { title: title.trim(), description: description.trim(), buttons: editing.menu_config?.buttons || [] }, is_active: isActive }
        : { instanceId, menu_config: { title: title.trim(), description: description.trim(), buttons: [] }, is_active: isActive };
      const res = await fetch("/api/auto-responses", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const p = await res.json();
      if (p.status === "success") { toast.success(editing ? "Actualizado" : "Agregado"); resetForm(); load(); }
      else toast.error(p.error || "Error");
    } catch { toast.error("Error inesperado"); }
  }

  async function toggle(id: string) {
    const m = menus.find(x => x.id === id); if (!m) return;
    await fetch("/api/auto-responses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active: !m.is_active }) });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este menú?")) return;
    await fetch(`/api/auto-responses?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25">
              <Menu className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Menús interactivos</h1>
            <p className="text-xs text-slate-400 mt-0.5">{menus.length} menú{menus.length !== 1 ? "s" : ""} · Botones navegables</p>
          </div>
          {!editing && !showForm && (
            <Button onClick={() => setShowForm(true)} className="h-10 rounded-xl gap-1.5 bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-300 hover:to-violet-400 text-slate-950 font-semibold shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-400/40">
              <Plus className="h-4 w-4" strokeWidth={2.5} />Nuevo
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(editing || showForm) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-3">
              <div className="rounded-2xl border-2 border-violet-400/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-100">{editing ? "Editar menú" : "Nuevo menú"}</p>
                  <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7 text-slate-400 hover:text-slate-200"><X className="h-3.5 w-3.5" /></Button>
                </div>
                <Input placeholder="Título del menú" value={title} onChange={e => setTitle(e.target.value)} className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-2" />
                <Input placeholder="Descripción" value={description} onChange={e => setDescription(e.target.value)} className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-2" />
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-300">Estado:</span>
                  <Button variant={isActive ? "outline" : "default"} size="sm" onClick={() => setIsActive(true)} className="h-8 text-xs">Activo</Button>
                  <Button variant={isActive ? "default" : "outline"} size="sm" onClick={() => setIsActive(false)} className="h-8 text-xs">Inactivo</Button>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-xs text-slate-300">Cancelar</Button>
                  <Button onClick={onSubmit} size="sm" className="h-8 text-xs bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-300 hover:to-violet-400 text-slate-950 font-semibold">Guardar</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />)}</div>
        ) : filteredMenus.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/[0.06] p-12 text-center">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{search ? "Sin resultados" : "Sin menús aún"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredMenus.map((m, idx) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Card className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-md overflow-hidden shadow-xl shadow-black/30 hover:border-white/[0.12] transition-all">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                      <span className="text-xs font-bold text-violet-400 truncate">{m.menu_config?.title || "Sin título"}</span>
                      <span className="ml-auto text-[10px] text-slate-500">{m.menu_config?.buttons?.length || 0} opciones</span>
                      <Badge variant={m.is_active ? "default" : "secondary"} className={m.is_active ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px]" : "bg-rose-400/10 text-rose-400 border-rose-400/20 text-[10px]"}>{m.is_active ? "Activo" : "Inactivo"}</Badge>
                    </div>
                    <div className="p-4 space-y-2">
                      {m.menu_config?.description && <p className="text-sm text-slate-300">{m.menu_config.description}</p>}
                      {m.menu_config?.buttons && m.menu_config.buttons.length > 0 && (
                        <div className="p-2.5 bg-violet-500/[0.04] rounded-xl border border-violet-400/10">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-1.5">Botones</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.menu_config.buttons.map(b => (
                              <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-400/15">{b.text}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex gap-1">
                      {editing?.id === m.id ? (
                        <>
                          <Button onClick={onSubmit} size="icon" className="h-7 w-7 bg-emerald-500 hover:bg-emerald-400 text-slate-950" title="Guardar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7 text-slate-300" title="Cancelar"><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(m)} className="h-7 w-7 text-slate-400 hover:text-violet-400 hover:bg-violet-400/10" title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle(m.id)} className="h-7 w-7 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10" title={m.is_active ? "Pausar" : "Activar"}>{m.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10" onClick={() => remove(m.id)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
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