"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AutoResponse, MenuButton } from "@/lib/supabase/types";
import {
  CheckIcon,
  LoaderIcon,
  PenIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
  ZapIcon,
  ChevronDownIcon,
} from "@/components/icons";

interface SubOption {
  id: string;
  text: string;
  target_id: string | null;
}

interface SubMenu {
  title: string;
  description: string;
  footer: string;
  buttons: SubOption[];
  savedId?: string | null; // auto_response id if this submenu was already persisted
}

interface MenuOption {
  id: string;
  text: string;
  mode: "text" | "submenu";
  target_id: string | null; // text mode: linked auto-response
  submenu: SubMenu | null; // submenu mode: inline submenu
}

interface MenuItem {
  id: string;
  title: string;
  description: string;
  footer: string;
  buttons: MenuOption[];
}

const newSubOption = (): SubOption => ({ id: crypto.randomUUID().slice(0, 8), text: "", target_id: null });

const newSubMenu = (): SubMenu => ({
  title: "",
  description: "",
  footer: "",
  buttons: [newSubOption(), newSubOption(), newSubOption()],
});

const newOption = (): MenuOption => ({
  id: crypto.randomUUID().slice(0, 8),
  text: "",
  mode: "text",
  target_id: null,
  submenu: null,
});

const emptyItem = (): MenuItem => ({
  id: crypto.randomUUID().slice(0, 8),
  title: "",
  description: "",
  footer: "",
  buttons: [newOption(), newOption(), newOption()],
});

export default function MenusPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [menus, setMenus] = useState<AutoResponse[]>([]);
  const [textResponses, setTextResponses] = useState<AutoResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState<AutoResponse | null>(null);
  const [search, setSearch] = useState("");
  const [item, setItem] = useState<MenuItem>(emptyItem());
  const [isActive, setIsActive] = useState(true);
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

        const [menusRes, textsRes] = await Promise.all([
          fetch(`/api/auto-responses?instanceId=${id}&type=menu`),
          fetch(`/api/auto-responses?instanceId=${id}&type=text`),
        ]);
        const menusPayload = await menusRes.json();
        const textsPayload = await textsRes.json();
        if (menusPayload.status === "success") setMenus(menusPayload.data);
        if (textsPayload.status === "success") setTextResponses(textsPayload.data);
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

  const filteredMenus = useMemo(() => {
    if (!search.trim()) return menus;
    const q = search.trim().toLowerCase();
    return menus.filter(
      (m) =>
        m.menu_config?.title?.toLowerCase().includes(q) ||
        m.menu_config?.buttons?.some((b) => b.text.toLowerCase().includes(q)),
    );
  }, [menus, search]);

  // Resolve a submenu inline when editing: find the linked menu by target_id
  function submenuFromTarget(targetId: string | null): SubMenu | null {
    if (!targetId) return null;
    const linked = menus.find((m) => m.id === targetId);
    if (!linked?.menu_config) return null;
    return {
      title: linked.menu_config.title,
      description: linked.menu_config.description || "",
      footer: linked.menu_config.footer || "",
      buttons: linked.menu_config.buttons?.map((b) => ({ id: b.id, text: b.text, target_id: b.target_id })) || [],
      savedId: linked.id,
    };
  }

  function openCreate() {
    setItem(emptyItem());
    setIsActive(true);
    setEditingMenu(null);
    setShowForm(true);
  }

  function openEdit(m: AutoResponse) {
    setEditingMenu(m);
    setItem({
      id: m.id,
      title: m.menu_config?.title || "",
      description: m.menu_config?.description || "",
      footer: m.menu_config?.footer || "",
      buttons: (m.menu_config?.buttons?.length ? m.menu_config.buttons : [newOption(), newOption(), newOption()]).map((b) => {
        const submenu = submenuFromTarget(b.target_id);
        return {
          id: b.id,
          text: b.text,
          mode: submenu ? "submenu" : "text",
          target_id: submenu ? null : b.target_id,
          submenu,
        };
      }),
    });
    setIsActive(m.is_active);
    setShowForm(true);
  }

  const hasTitle = item.title.trim();
  const hasAnyText = item.buttons.some((b) => b.text.trim());

  function updateButton(idx: number, patch: Partial<MenuOption>) {
    const next = [...item.buttons];
    next[idx] = { ...next[idx], ...patch };
    setItem({ ...item, buttons: next });
  }

  function updateSubOption(btnIdx: number, subIdx: number, patch: Partial<SubOption>) {
    const next = [...item.buttons];
    const sub = next[btnIdx].submenu;
    if (!sub) return;
    const subButtons = [...sub.buttons];
    subButtons[subIdx] = { ...subButtons[subIdx], ...patch };
    next[btnIdx] = { ...next[btnIdx], submenu: { ...sub, buttons: subButtons } };
    setItem({ ...item, buttons: next });
  }

  // Save: persist submenus first (they are auto_responses of type menu), then the parent.
  async function handleSave() {
    if (!instanceId) return;
    setSaving(true);
    setFeedback(null);
    try {
      // 1. Persist inline submenus → get their saved ids
      const buttons = await Promise.all(
        item.buttons.map(async (btn, btnIdx) => {
          const base = { id: btn.id, text: btn.text.trim() };
          if (!base.text) return null;

          if (btn.mode === "submenu" && btn.submenu) {
            const sub = btn.submenu;
            const subButtons = sub.buttons.filter((sb) => sb.text.trim());
            if (subButtons.length === 0) {
              return { ...base, target_id: null };
            }
            const subMenuConfig = {
              title: sub.title || base.text,
              description: sub.description,
              footer: sub.footer || undefined,
              buttons: subButtons.map((sb, i) => ({
                id: sb.id || `${base.id}_s${i}`,
                text: sb.text.trim(),
                target_id: sb.target_id || null,
              })),
            };
            const method = sub.savedId ? "PUT" : "POST";
            const body = sub.savedId
              ? { id: sub.savedId, responseType: "menu", menuConfig: subMenuConfig, isActive: true }
              : { instanceId, responseType: "menu", menuConfig: subMenuConfig, isActive: true };
            const res = await fetch("/api/auto-responses", {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const payload = await res.json();
            if (payload.status !== "success") {
              throw new Error(payload.error || "Error al guardar submenú");
            }
            return { ...base, target_id: payload.data.id };
          }

          // text mode
          return { ...base, target_id: btn.target_id || null };
        }),
      );

      const finalButtons = buttons.filter((b): b is { id: string; text: string; target_id: string | null } => b !== null);

      const menuConfig = {
        title: item.title,
        description: item.description,
        footer: item.footer || undefined,
        buttons: finalButtons,
      };

      const method = editingMenu ? "PUT" : "POST";
      const body = editingMenu
        ? { id: editingMenu.id, responseType: "menu", menuConfig, isActive }
        : { instanceId, responseType: "menu", menuConfig, isActive };

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

      setFeedback({ kind: "success", message: editingMenu ? "Menú actualizado" : "Menú creado" });
      setShowForm(false);
      await loadData();
    } catch (e) {
      setFeedback({ kind: "error", message: e instanceof Error ? e.message : "Error de red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este menú y sus submenús?")) return;
    await fetch(`/api/auto-responses?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  async function handleToggle(m: AutoResponse) {
    await fetch("/api/auto-responses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, isActive: !m.is_active }),
    });
    await loadData();
  }

  function targetLabel(id: string): string {
    const t = textResponses.find((r) => r.id === id);
    if (t) return `💬 ${t.keyword || t.response_text.slice(0, 20)}`;
    const m = menus.find((r) => r.id === id);
    if (m) return `🔘 ${m.menu_config?.title || "submenú"}`;
    return "—";
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-[#53bdeb]">
            <ZapIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Menús interactivos</p>
            <p className="text-[10px] text-wa-text-secondary/60">
              {menus.length} menú{menus.length !== 1 ? "s" : ""} · hasta 3 opciones con submenús
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!instanceId}
          className="flex items-center gap-1.5 rounded-lg bg-[#53bdeb] px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-[#53bdeb]/20 transition hover:bg-[#53bdeb]/90 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Nuevo menú
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs fade-up ${
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
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-wa-text-secondary/50" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar menú u opción..."
                  className="w-full rounded-xl border border-wa-border bg-wa-header py-2.5 pl-9 pr-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>
            </div>

            {menus.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-wa-border bg-wa-header p-10 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#53bdeb]/10">
                  <ZapIcon className="h-7 w-7 text-[#53bdeb]" />
                </div>
                <p className="text-sm font-semibold text-wa-text">Creá tu primer menú interactivo</p>
                <p className="mt-1 text-xs text-wa-text-secondary">
                  Cada opción puede responder con texto o abrir un submenú con sus propias opciones
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 rounded-lg bg-[#53bdeb] px-4 py-2 text-xs font-semibold text-white hover:bg-[#53bdeb]/90"
                >
                  + Nuevo menú
                </button>
              </div>
            ) : filteredMenus.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-wa-border bg-wa-header p-10 text-center">
                <p className="text-sm text-wa-text-secondary">No hay menús que coincidan con tu búsqueda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMenus.map((m) => (
                  <div key={m.id} className="overflow-hidden rounded-2xl border border-wa-border bg-wa-header">
                    {/* Header */}
                    <div className="flex items-center gap-3 border-b border-wa-border/50 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-[#53bdeb]">
                        <ZapIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-wa-text">
                          {m.menu_config?.title || "Sin título"}
                        </p>
                        <p className="text-[10px] text-wa-text-secondary/50">
                          {m.menu_config?.buttons?.length || 0} opciones
                          {m.menu_config?.description ? ` · ${m.menu_config.description}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          m.is_active ? "bg-[#00a884]/15 text-[#00a884]" : "bg-wa-text-secondary/10 text-wa-text-secondary/60"
                        }`}
                      >
                        {m.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => void handleToggle(m)}
                          className="rounded-lg p-1.5 text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                          title={m.is_active ? "Desactivar" : "Activar"}
                        >
                          {m.is_active ? "⏸" : "▶"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="rounded-lg p-1.5 text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                          title="Editar"
                        >
                          <PenIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(m.id)}
                          className="rounded-lg p-1.5 text-red-400/50 transition hover:bg-red-500/10 hover:text-red-400"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Options */}
                    {m.menu_config?.buttons && m.menu_config.buttons.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3">
                        {m.menu_config.buttons.map((b) => {
                          const isSub = b.target_id && menus.some((x) => x.id === b.target_id);
                          return (
                            <div key={b.id} className="rounded-xl border border-wa-border/50 bg-wa-panel/50 px-3 py-2">
                              <p className="truncate text-xs font-semibold text-wa-text">{b.text}</p>
                              <p className="mt-0.5 truncate text-[10px] text-wa-text-secondary/50">
                                {isSub ? `🔘 Submenú · ${targetLabel(b.target_id!)}` : b.target_id ? targetLabel(b.target_id) : "Responde con el texto"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-wa-text">{editingMenu ? "Editar menú" : "Nuevo menú"}</h3>
                <p className="text-[10px] text-wa-text-secondary/60">Cada opción responde con texto o abre un submenú</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">Título del menú</label>
                <input
                  type="text"
                  placeholder='Ej: "¿En qué te puedo ayudar?"'
                  value={item.title}
                  onChange={(e) => setItem({ ...item, title: e.target.value })}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Descripción <span className="text-wa-text-secondary/40">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder='Ej: "Elegí una opción"'
                  value={item.description}
                  onChange={(e) => setItem({ ...item, description: e.target.value })}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                />
              </div>

              {/* Options */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Opciones <span className="text-wa-text-secondary/40">(hasta 3)</span>
                </label>
                {item.buttons.map((btn, idx) => (
                  <div key={btn.id} className="rounded-xl border border-wa-border/50 bg-wa-input p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#53bdeb]/10 text-[10px] font-bold text-[#53bdeb]">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder={`Opción ${idx + 1}`}
                        value={btn.text}
                        onChange={(e) => updateButton(idx, { text: e.target.value })}
                        className="flex-1 rounded-lg border border-wa-border bg-wa-panel px-3 py-2 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                      />
                      {/* Mode toggle */}
                      <button
                        type="button"
                        onClick={() => updateButton(idx, {
                          mode: btn.mode === "text" ? "submenu" : "text",
                          target_id: btn.mode === "text" ? null : btn.target_id,
                          submenu: btn.mode === "text" ? (btn.submenu || newSubMenu()) : null,
                        })}
                        className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                          btn.mode === "submenu"
                            ? "bg-[#53bdeb]/20 text-[#53bdeb]"
                            : "bg-wa-panel text-wa-text-secondary hover:bg-wa-hover"
                        }`}
                        title="Alternar texto / submenú"
                      >
                        {btn.mode === "submenu" ? "🔘 Submenú" : "💬 Texto"}
                      </button>
                    </div>

                    {btn.mode === "text" ? (
                      /* Text mode: optional suggested response */
                      <select
                        value={btn.target_id || ""}
                        onChange={(e) => updateButton(idx, { target_id: e.target.value || null })}
                        className="w-full rounded-lg border border-wa-border bg-wa-panel px-2 py-2 text-[11px] text-wa-text-secondary focus:border-[#53bdeb] focus:outline-none"
                      >
                        <option value="">— Responder con el texto del botón —</option>
                        <optgroup label="Respuestas de texto (sugeridas)">
                          {textResponses.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.keyword || r.response_text.slice(0, 30)}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    ) : (
                      /* Submenu mode: inline editor */
                      <div className="space-y-2 rounded-lg border border-[#53bdeb]/30 bg-[#53bdeb]/5 p-3">
                        <div className="flex items-center gap-2">
                          <ChevronDownIcon className="h-3.5 w-3.5 text-[#53bdeb]" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#53bdeb]">
                            Submenú de "{btn.text || `Opción ${idx + 1}`}"
                          </span>
                        </div>
                        {btn.submenu && (
                          <>
                            <input
                              type="text"
                              placeholder="Título del submenú"
                              value={btn.submenu.title}
                              onChange={(e) => {
                                const next = [...item.buttons];
                                const sub = next[idx].submenu!;
                                next[idx] = { ...next[idx], submenu: { ...sub, title: e.target.value } };
                                setItem({ ...item, buttons: next });
                              }}
                              className="w-full rounded-lg border border-wa-border bg-wa-panel px-3 py-2 text-xs text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                            />
                            {btn.submenu.buttons.map((sb, subIdx) => (
                              <div key={sb.id} className="flex items-center gap-1.5">
                                <span className="w-3 text-[10px] font-bold text-[#53bdeb]">{subIdx + 1}</span>
                                <input
                                  type="text"
                                  placeholder={`Sub-opción ${subIdx + 1}`}
                                  value={sb.text}
                                  onChange={(e) => updateSubOption(idx, subIdx, { text: e.target.value })}
                                  className="flex-1 rounded-lg border border-wa-border bg-wa-panel px-2.5 py-1.5 text-xs text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                                />
                                <select
                                  value={sb.target_id || ""}
                                  onChange={(e) => updateSubOption(idx, subIdx, { target_id: e.target.value || null })}
                                  className="max-w-[110px] rounded-lg border border-wa-border bg-wa-panel px-1.5 py-1.5 text-[10px] text-wa-text-secondary focus:border-[#53bdeb] focus:outline-none"
                                >
                                  <option value="">Texto</option>
                                  {textResponses.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.keyword || r.response_text.slice(0, 18)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Footer <span className="text-wa-text-secondary/40">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder='Ej: "Boti - Tu asistente"'
                  value={item.footer}
                  onChange={(e) => setItem({ ...item, footer: e.target.value })}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#53bdeb] focus:outline-none"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-xl border border-wa-border bg-wa-input px-4 py-3">
                <span className="text-sm text-wa-text">Menú activo</span>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${isActive ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                >
                  <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-[22px]" : "translate-x-0.5"}`} />
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
                  disabled={saving || !hasTitle || !hasAnyText}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#53bdeb] py-3 text-sm font-semibold text-white hover:bg-[#53bdeb]/90 disabled:opacity-50"
                >
                  {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Guardando..." : "Guardar menú"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}