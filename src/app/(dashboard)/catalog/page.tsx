"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit2, X, ShoppingBag, ChevronRight, Tag,
  Eye, EyeOff, GripVertical, Search, Check, Package, Sparkles
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { colors, layout } from "@/lib/design-system";
import type { CatalogItem } from "@/lib/supabase/types";

interface CategoryGroup {
  name: string;
  items: CatalogItem[];
  expanded: boolean;
}

function SortableItem({ item, editing, label, price, onStartEdit, onSave, onCancel, onToggle, onDelete, onLabelChange, onPriceChange }: {
  item: CatalogItem; editing: CatalogItem | null; label: string; price: string;
  onStartEdit: (it: CatalogItem) => void; onSave: () => void; onCancel: () => void;
  onToggle: (id: string) => void; onDelete: (id: string) => void;
  onLabelChange: (v: string) => void; onPriceChange: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isEditing = editing?.id === item.id;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all",
        !item.active && "opacity-50",
        isDragging && "bg-cyan-500/10 shadow-xl shadow-cyan-500/20 z-20 ring-1 ring-cyan-400/40",
        !isDragging && colors.surface.cardHover,
        "bg-white/[0.02]"
      )}
    >
      <button
        type="button"
        {...attributes} {...listeners}
        className="text-slate-500 hover:text-cyan-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-1.5">
            <Input value={label} onChange={e => onLabelChange(e.target.value)} className="h-7 text-xs flex-1 bg-white/[0.04] border-white/10" placeholder="Nombre" />
            <Input value={price} onChange={e => onPriceChange(e.target.value)} className="h-7 text-xs w-20 bg-white/[0.04] border-white/10" placeholder="$" type="number" />
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium truncate text-slate-200">{item.label}</p>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="font-bold text-cyan-400">${(item.price_cents / 100).toFixed(2)}</span>
              {!item.active && <span className="text-rose-400">· Pausado</span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <Button onClick={onSave} size="icon" className="h-7 w-7 bg-emerald-500 hover:bg-emerald-400 text-slate-950" title="Guardar"><Check className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-7 w-7 text-slate-400 hover:text-slate-100" title="Cancelar"><X className="h-3.5 w-3.5" /></Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" onClick={() => onStartEdit(item)} className="h-7 w-7 text-slate-400 hover:text-cyan-400" title="Editar"><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" onClick={() => onToggle(item.id)} className="h-7 w-7 text-slate-400 hover:text-emerald-400" title={item.active ? "Pausar" : "Activar"}>{item.active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-400" onClick={() => onDelete(item.id)} title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  // loading derivado: true hasta que los items se cargan para el instanceId actual
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = instanceId ? loadedFor !== instanceId : true;
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    if (!instanceId) return;
    const res = await fetch(`/api/catalog?instanceId=${instanceId}`);
    const p = await res.json();
    if (p.status === "success") setItems(p.data);
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

  // Grupos derivados de items/filtro/búsqueda (antes: setState en efecto).
  const groups: CategoryGroup[] = useMemo(() => {
    let filtered = items;
    if (filter !== "all") filtered = items.filter(it => filter === "active" ? it.active : !it.active);
    if (search) filtered = filtered.filter(it => it.label.toLowerCase().includes(search.toLowerCase()) || it.category?.toLowerCase().includes(search.toLowerCase()));
    const map = new Map<string, CatalogItem[]>();
    filtered.forEach((it: CatalogItem) => {
      const cat = it.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    });
    const sortedCats = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sortedCats.map(([name, items]) => ({ name, items, expanded: !collapsed.has(name) }));
  }, [items, filter, search, collapsed]);

  const existingCategories = [...new Set(items.map(i => i.category).filter(Boolean))] as string[];
  const totalActive = items.filter(it => it.active).length;

  function reset() { setEditing(null); setShowNew(false); setLabel(""); setPrice(""); setCategory(""); }

  async function handleSave() {
    if (!label?.trim()) { toast.error("Nombre requerido"); return; }
    const cents = Math.round(parseFloat(price || "0") * 100);
    const body = editing
      ? { id: editing.id, label: label.trim(), price_cents: cents, category: category.trim() || null }
      : { instanceId, label: label.trim(), price_cents: cents, category: category.trim() || null, sort_order: items.length };
    const res = await fetch("/api/catalog", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const p = await res.json();
    if (p.status === "success") { toast.success(editing ? "Actualizado" : "Agregado"); reset(); load(); }
    else toast.error(p.error);
  }

  async function toggleActive(id: string) {
    const item = items.find(i => i.id === id); if (!item) return;
    await fetch("/api/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active: !item.active }) });
    load();
  }

  function startEdit(it: CatalogItem) { setEditing(it); setLabel(it.label); setPrice((it.price_cents / 100).toString()); setCategory(it.category || ""); setShowNew(false); }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const group = groups.find(g => g.items.some(it => it.id === active.id));
    if (!group) return;
    const oldIndex = group.items.findIndex(it => it.id === active.id);
    const newIndex = group.items.findIndex(it => it.id === over.id);
    const newItems = arrayMove(group.items, oldIndex, newIndex);
    newItems.forEach(async (it, i) => {
      await fetch("/api/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: it.id, sort_order: i }) });
    });
    load();
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/30">
              <ShoppingBag className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Catálogo</h1>
            <p className="text-xs text-slate-400 mt-0.5">Productos que el bot ofrece cuando escriben <span className="text-cyan-400 font-semibold">&quot;pedido&quot;</span></p>
          </div>
          {!showNew && !editing && (
            <Button onClick={() => setShowNew(true)} className="h-10 rounded-xl gap-1.5 bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-400/40">
              <Plus className="h-4 w-4" strokeWidth={2.5} />Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Stats + Filtros */}
      <div className="px-4 sm:px-6 pb-3 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activos</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 mt-1">{totalActive}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pausados</p>
          <p className="text-xl sm:text-2xl font-extrabold text-rose-400 mt-1">{items.length - totalActive}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Categorías</p>
          <p className="text-xl sm:text-2xl font-extrabold text-cyan-400 mt-1">{existingCategories.length || 1}</p>
        </div>
      </div>

      {/* Filtros + Buscar */}
      <div className="px-4 sm:px-6 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto o categoría..." className="pl-9 h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-cyan-400/20" />
        </div>
        <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] p-0.5 rounded-xl">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all", filter === f ? "bg-gradient-to-br from-cyan-400/20 to-cyan-500/10 text-cyan-300 shadow-sm border border-cyan-400/30" : "text-slate-500 hover:text-slate-300")}>
              {f === "all" ? "Todos" : f === "active" ? "Activos" : "Pausados"}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario inline */}
      <AnimatePresence>
        {(showNew || editing) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-3">
              <div className="rounded-2xl border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.04] to-transparent p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <p className="text-sm font-semibold text-slate-100">{editing ? "Editar producto" : "Nuevo producto"}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={reset} className="h-7 w-7 text-slate-400 hover:text-slate-100"><X className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Input placeholder="Nombre" value={label} onChange={e => setLabel(e.target.value)} className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500" />
                  <Input placeholder="Precio" type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500" />
                </div>
                <div className="flex gap-2 items-center">
                  <Input placeholder="Categoría" value={category} onChange={e => setCategory(e.target.value)} className="h-9 text-sm flex-1 bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500" />
                  <Button onClick={handleSave} size="sm" className="h-9 text-xs gap-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-semibold"><Check className="h-3.5 w-3.5" strokeWidth={2.5} />Guardar</Button>
                </div>
                {existingCategories.length > 0 && !category && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {existingCategories.map(c => <button key={c} type="button" onClick={() => setCategory(c)} className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-slate-300">{c}</button>)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmación de eliminar */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-3">
              <div className="rounded-2xl border-2 border-rose-400/30 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-rose-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-100">¿Eliminar producto?</p>
                  <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)} className="h-8 text-xs text-slate-300">Cancelar</Button>
                <Button size="sm" className="h-8 text-xs bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-semibold" onClick={async () => { await fetch(`/api/catalog?id=${confirmDelete}`, { method: "DELETE" }); setConfirmDelete(null); load(); }}>Eliminar</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid de categorías */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {loading ? (
          <div className={layout.grid}>{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/[0.04]" />)}</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/[0.08] p-12 text-center">
            <Package className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{search || filter !== "all" ? "Sin resultados" : "Empezá agregando tu primer producto"}</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className={layout.grid}>
              {groups.map(g => (
                <div key={g.name} className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm overflow-hidden flex flex-col shadow-xl shadow-black/20">
                  <div className="flex items-center gap-2 px-3 py-3 bg-white/[0.04] border-b border-white/[0.06] cursor-pointer select-none" onClick={() => setCollapsed(prev => { const next = new Set(prev); if (next.has(g.name)) next.delete(g.name); else next.add(g.name); return next; })}>
                    <ChevronRight className={`h-4 w-4 text-cyan-400 transition-transform duration-200 ${g.expanded ? "rotate-90" : ""}`} />
                    <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold truncate text-slate-100">{g.name}</span>
                    <span className="ml-auto text-[10px] font-bold text-slate-300 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.06]">{g.items.length}</span>
                  </div>
                  {g.expanded && (
                    <SortableContext items={g.items.map(it => it.id)} strategy={verticalListSortingStrategy} id={g.name}>
                      <div className="p-2 space-y-1 flex-1">
                        {g.items.map(it => (
                          <SortableItem
                            key={it.id}
                            item={it}
                            editing={editing}
                            label={label}
                            price={price}
                            onStartEdit={startEdit}
                            onSave={handleSave}
                            onCancel={reset}
                            onToggle={toggleActive}
                            onDelete={(id) => setConfirmDelete(id)}
                            onLabelChange={setLabel}
                            onPriceChange={setPrice}
                          />
                        ))}
                        {g.items.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Sin productos</p>}
                      </div>
                    </SortableContext>
                  )}
                </div>
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}