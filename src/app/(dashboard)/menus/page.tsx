"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AutoResponse } from "@/lib/db/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pencil, X, Eye, EyeOff, Layers, Menu, ChevronDown } from "lucide-react";

/* =========================================================
   Menús interactivos: editor de opciones y submenús
   ---------------------------------------------------------
   Este editor SE PERDIÓ en la migración a MariaDB (commit
   `ae0e422` lo tenía, `9e894e1` ya no) y con él se perdió la
   única forma de crear un menú: el formulario solo editaba
   título y descripción y mandaba siempre `buttons: []`, que
   la API rechaza ("Un menú necesita al menos un botón").

   Estructura, que es la que espera `menu_config`:

     { title, description, footer, buttons: [{ id, text, target_id }] }

   Un submenú NO es una tabla aparte: se persiste como otro
   `bots_responses` de `response_type = 'menu'`, y el botón del
   padre lo apunta con `target_id`. Así es como los resuelve
   `sendMenuResponse` / `handleMenuTap`.

   Límites: 3 opciones por nivel y 2 niveles. Los 3 son el
   tope de WhatsApp; el fallback a texto admite 9, pero más de
   3 opciones en pantalla es ilegible y el submenú de segundo
   nivel ya cumple su función.

   El `id` de cada botón es interno (lo usa `menu_back_<id>`)
   y no sale a la base: se genera en el cliente. Sin `crypto`
   porque la página se prerenderiza en el servidor.
   ========================================================= */

const MAX_OPCIONES = 3;

/** Un botón tal como vive en `menu_config.buttons`.
    `AutoResponse.menu_config` es `Record<string, any>`, así que sin esto
    TypeScript no puede tipar los `map` y los callbacks quedan en `any`. */
interface BotonMenu {
  id: string;
  text: string;
  target_id: string | null;
}

let contador = 0;
function idLocal(prefijo: string): string {
  contador += 1;
  return `${prefijo}${contador.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

interface Opcion {
  id: string;
  text: string;
  /** "texto" responde con un texto; "submenu" abre otro menú. */
  modo: "texto" | "submenu";
  /** Solo en modo texto: respuesta de `bots_responses` a la que responde. */
  target_id: string | null;
  /** Solo en modo submenu. */
  submenu: SubMenu | null;
}

interface SubMenu {
  /** id de la fila en `bots_responses` si el submenú ya está guardado. */
  savedId: string | null;
  title: string;
  description: string;
  footer: string;
  botones: SubOpcion[];
}

interface SubOpcion {
  id: string;
  text: string;
  target_id: string | null;
}

function nuevaSubOpcion(): SubOpcion {
  return { id: idLocal("s"), text: "", target_id: null };
}

function nuevoSubmenu(): SubMenu {
  return {
    savedId: null,
    title: "",
    description: "",
    footer: "",
    botones: [nuevaSubOpcion(), nuevaSubOpcion(), nuevaSubOpcion()],
  };
}

function nuevaOpcion(): Opcion {
  return { id: idLocal("b"), text: "", modo: "texto", target_id: null, submenu: null };
}

/** Un menú nuevo arranca con las 3 casillas vacías, no con una sola. */
function menuVacio(): { title: string; description: string; footer: string; botones: Opcion[] } {
  return {
    title: "",
    description: "",
    footer: "",
    botones: [nuevaOpcion(), nuevaOpcion(), nuevaOpcion()],
  };
}

export default function MenusPage() {
  const [menus, setMenus] = useState<AutoResponse[]>([]);
  const [textos, setTextos] = useState<AutoResponse[]>([]);
  // loading derivado: true hasta que los datos se cargan una vez.
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState<AutoResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  /* No hay caja de búsqueda en esta pantalla, así que el filtro se queda con
     el valor fijo de abajo. Se mantiene el `useState` para no cambiar la
     estructura, pero sin setter, que eslint marca como sin usar. */
  const [search] = useState("");
  const [borrador, setBorrador] = useState(menuVacio);
  const [isActive, setIsActive] = useState(true);
  const [guardando, setGuardando] = useState(false);

  /* El bot sale de la sesión (RLS): el endpoint ya no usa `?instanceId=`
     para decidir de quién son las respuestas, así que no se manda. */
  const load = useCallback(async () => {
    const [resMenus, resTextos] = await Promise.all([
      fetch("/api/auto-responses?type=menu"),
      fetch("/api/auto-responses?type=text"),
    ]);
    const pm = await resMenus.json();
    if (pm.status === "success") setMenus(pm.data ?? []);
    const pt = await resTextos.json();
    if (pt.status === "success") setTextos(pt.data ?? []);
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      await load();
      if (!cancelado) setCargado(true);
    })();
    return () => { cancelado = true; };
  }, [load]);

  const loading = !cargado;

  const filtrados = useMemo(() => {
    if (!search.trim()) return menus;
    const q = search.trim().toLowerCase();
    return menus.filter(
      (m) =>
        (m.menu_config?.title || "").toLowerCase().includes(q) ||
        (m.menu_config?.buttons || []).some((b: BotonMenu) => b.text.toLowerCase().includes(q))
    );
  }, [menus, search]);

  /** Los submenús son filas de `bots_responses` de tipo menu, así que para
      reconstruir el editor inline hay que resolver su `target_id` contra la
      lista de menús ya cargada. */
  function submenuDesdeTarget(targetId: string | null): SubMenu | null {
    if (!targetId) return null;
    const ligado = menus.find((m) => m.id === targetId);
    if (!ligado?.menu_config) return null;
    const botones = ligado.menu_config.buttons || [];
    return {
      savedId: ligado.id,
      title: ligado.menu_config.title || "",
      description: ligado.menu_config.description || "",
      footer: ligado.menu_config.footer || "",
      botones: (botones.length ? botones : []).map((b: BotonMenu) => ({
        id: b.id,
        text: b.text,
        target_id: b.target_id ?? null,
      })),
    };
  }

  function abrirCrear() {
    setBorrador(menuVacio());
    setIsActive(true);
    setEditando(null);
    setShowForm(true);
  }

  function abrirEditar(m: AutoResponse) {
    const botones = m.menu_config?.buttons || [];
    setBorrador({
      title: m.menu_config?.title || "",
      description: m.menu_config?.description || "",
      footer: m.menu_config?.footer || "",
      botones: (botones.length ? botones : [nuevaOpcion(), nuevaOpcion(), nuevaOpcion()]).map((b: BotonMenu) => {
        const submenu = submenuDesdeTarget(b.target_id);
        return {
          id: b.id,
          text: b.text,
          modo: submenu ? "submenu" : "texto",
          target_id: submenu ? null : b.target_id ?? null,
          submenu,
        };
      }),
    });
    setIsActive(m.is_active);
    setEditando(m);
    setShowForm(true);
  }

  function resetForm() {
    setEditando(null);
    setShowForm(false);
    setBorrador(menuVacio());
    setIsActive(true);
  }

  function actualizarOpcion(idx: number, patch: Partial<Opcion>) {
    setBorrador((b) => {
      const botones = [...b.botones];
      botones[idx] = { ...botones[idx], ...patch };
      return { ...b, botones };
    });
  }

  function actualizarSubmenu(idx: number, patch: Partial<SubMenu>) {
    setBorrador((b) => {
      const botones = [...b.botones];
      const submenu = botones[idx].submenu;
      if (!submenu) return b;
      botones[idx] = { ...botones[idx], submenu: { ...submenu, ...patch } };
      return { ...b, botones };
    });
  }

  function actualizarSubOpcion(idx: number, subIdx: number, patch: Partial<SubOpcion>) {
    setBorrador((b) => {
      const botones = [...b.botones];
      const submenu = botones[idx].submenu;
      if (!submenu) return b;
      const subs = [...submenu.botones];
      subs[subIdx] = { ...subs[subIdx], ...patch };
      botones[idx] = { ...botones[idx], submenu: { ...submenu, botones: subs } };
      return { ...b, botones };
    });
  }

  /* ---- Validación ---- */

  /* `MAX_OPCIONES` es el tope de botones de WhatsApp, así que no es
     decorativo: aunque el editor hoy siempre dibuje 3 casillas, el recorte
     evita que un `menu_config` raro llegue a Evolution con más. */
  const opcionesConTexto = borrador.botones.filter((b) => b.text.trim()).slice(0, MAX_OPCIONES);
  const tituloVacio = !borrador.title.trim();
  const sinOpciones = opcionesConTexto.length === 0;
  const submenuIncompleto = borrador.botones.some(
    (b) => b.modo === "submenu" && b.submenu && !b.submenu.botones.some((s) => s.text.trim())
  );

  const puedeGuardar = !tituloVacio && !sinOpciones && !submenuIncompleto && !guardando;

  /* ---- Guardado ----
     Los submenús primero: el padre necesita el id que devuelve la API para
     escribirlo en `target_id`. Si se guardara al revés, el padre quedaría
     apuntando a la nada. */
  async function onSubmit() {
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      const botones = [];
      for (const op of opcionesConTexto) {
        const texto = op.text.trim();

        if (op.modo === "submenu" && op.submenu) {
          const subs = op.submenu.botones.filter((s) => s.text.trim());
          if (subs.length === 0) {
            // Submenú sin opciones: la opción responde con su propio texto.
            botones.push({ id: op.id, text: texto, target_id: null });
            continue;
          }
          const sub = op.submenu;
          const menuConfig = {
            title: (sub.title || texto).trim(),
            description: sub.description.trim(),
            footer: sub.footer.trim(),
            buttons: subs.map((s) => ({ id: s.id, text: s.text.trim(), target_id: s.target_id || null })),
          };
          const res = await fetch("/api/auto-responses", {
            method: sub.savedId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              sub.savedId
                ? { id: sub.savedId, responseType: "menu", menuConfig, isActive: true }
                : { responseType: "menu", menuConfig, isActive: true }
            ),
          });
          const payload = await res.json();
          if (payload.status !== "success") {
            throw new Error(payload.error || `No se pudo guardar el submenú de "${texto}"`);
          }
          botones.push({ id: op.id, text: texto, target_id: payload.data.id });
          continue;
        }

        botones.push({ id: op.id, text: texto, target_id: op.target_id || null });
      }

      const menuConfig = {
        title: borrador.title.trim(),
        description: borrador.description.trim(),
        footer: borrador.footer.trim(),
        buttons: botones,
      };

      const res = await fetch("/api/auto-responses", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editando ? { id: editando.id, menuConfig, isActive } : { menuConfig, isActive }
        ),
      });
      const payload = await res.json();
      if (payload.status !== "success") throw new Error(payload.error || "Error");

      toast.success(editando ? "Menú actualizado" : "Menú creado");
      resetForm();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }

  async function toggle(id: string) {
    const m = menus.find((x) => x.id === id);
    if (!m) return;
    await fetch("/api/auto-responses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !m.is_active }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este menú?")) return;
    const res = await fetch(`/api/auto-responses?id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.status !== "success") {
      toast.error(payload.error || "No se pudo eliminar");
      return;
    }
    toast.success("Menú eliminado");
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
            <p className="text-xs text-slate-400 mt-0.5">
              {menus.length} menú{menus.length !== 1 ? "s" : ""} · hasta {MAX_OPCIONES} opciones por nivel
            </p>
          </div>
          {!editando && !showForm && (
            <Button onClick={abrirCrear} className="h-10 rounded-xl gap-1.5 bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-300 hover:to-violet-400 text-slate-950 font-semibold shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-400/40">
              <Plus className="h-4 w-4" strokeWidth={2.5} />Nuevo
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(editando || showForm) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-3">
              <div className="rounded-2xl border-2 border-violet-400/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-100">{editando ? "Editar menú" : "Nuevo menú"}</p>
                  <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7 text-slate-400 hover:text-slate-200">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Input
                  placeholder="Título del menú (ej: Menú del día)"
                  value={borrador.title}
                  onChange={(e) => setBorrador({ ...borrador, title: e.target.value })}
                  className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-2"
                />
                <Input
                  placeholder="Descripción (la línea chica arriba de los botones)"
                  value={borrador.description}
                  onChange={(e) => setBorrador({ ...borrador, description: e.target.value })}
                  className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-2"
                />
                <Input
                  placeholder="Pie del menú (opcional)"
                  value={borrador.footer}
                  onChange={(e) => setBorrador({ ...borrador, footer: e.target.value })}
                  className="h-9 text-sm bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500 mb-3"
                />

                <p className="text-xs font-bold uppercase tracking-wider text-violet-400 mb-2">Opciones</p>
                <div className="space-y-2 mb-3">
                  {borrador.botones.map((op, idx) => {
                    const tieneTexto = !!op.text.trim();
                    return (
                      <div key={op.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-5 shrink-0 text-xs font-bold text-violet-400">{idx + 1}.</span>
                          <Input
                            placeholder="Texto de la opción"
                            value={op.text}
                            onChange={(e) => actualizarOpcion(idx, { text: e.target.value })}
                            className="h-8 min-w-0 flex-1 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
                          />
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant={op.modo === "texto" ? "default" : "outline"}
                              size="sm"
                              onClick={() => actualizarOpcion(idx, { modo: "texto", submenu: null })}
                              className="h-8 text-[10px]"
                              title="Responde con un texto"
                            >
                              Texto
                            </Button>
                            <Button
                              variant={op.modo === "submenu" ? "default" : "outline"}
                              size="sm"
                              onClick={() => actualizarOpcion(idx, { modo: "submenu", target_id: null, submenu: op.submenu || nuevoSubmenu() })}
                              className="h-8 text-[10px]"
                              title="Abre otro menú"
                            >
                              Submenú
                            </Button>
                          </div>
                        </div>

                        {/* Modo texto: a qué auto-respuesta responde. Vacío = el
                            bot devuelve el texto de la opción tal cual. */}
                        {tieneTexto && op.modo === "texto" && (
                          <select
                            value={op.target_id || ""}
                            onChange={(e) => actualizarOpcion(idx, { target_id: e.target.value || null })}
                            className="mt-2 h-8 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 text-[11px] text-slate-300"
                          >
                            <option value="">Responder con el texto de la opción</option>
                            {textos.map((t) => (
                              <option key={t.id} value={t.id}>
                                {(t.keyword || t.response_text || "").slice(0, 60)}
                              </option>
                            ))}
                          </select>
                        )}

                        {tieneTexto && op.modo === "submenu" && op.submenu && (
                          <div className="mt-2 ml-5 space-y-2 rounded-lg border border-violet-400/15 bg-violet-500/[0.04] p-2.5">
                            <Input
                              placeholder="Título del submenú"
                              value={op.submenu.title}
                              onChange={(e) => actualizarSubmenu(idx, { title: e.target.value })}
                              className="h-8 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
                            />
                            <Input
                              placeholder="Descripción (opcional)"
                              value={op.submenu.description}
                              onChange={(e) => actualizarSubmenu(idx, { description: e.target.value })}
                              className="h-8 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
                            />
                            {op.submenu.botones.map((s, subIdx) => (
                              <div key={s.id} className="flex items-center gap-2">
                                <ChevronDown className="h-3 w-3 shrink-0 rotate-[-90deg] text-slate-500" />
                                <Input
                                  placeholder={`Sub-opción ${subIdx + 1}`}
                                  value={s.text}
                                  onChange={(e) => actualizarSubOpcion(idx, subIdx, { text: e.target.value })}
                                  className="h-8 min-w-0 flex-1 text-xs bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
                                />
                                {s.text.trim() && (
                                  <select
                                    value={s.target_id || ""}
                                    onChange={(e) => actualizarSubOpcion(idx, subIdx, { target_id: e.target.value || null })}
                                    className="h-8 w-40 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 text-[10px] text-slate-300"
                                  >
                                    <option value="">Respuesta de la opción</option>
                                    {textos.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {(t.keyword || t.response_text || "").slice(0, 40)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-300">Estado:</span>
                  <Button variant={isActive ? "outline" : "default"} size="sm" onClick={() => setIsActive(true)} className="h-8 text-xs">Activo</Button>
                  <Button variant={isActive ? "default" : "outline"} size="sm" onClick={() => setIsActive(false)} className="h-8 text-xs">Inactivo</Button>
                </div>

                {(tituloVacio || sinOpciones || submenuIncompleto) && (
                  <p className="mb-2 text-[11px] text-amber-400">
                    {tituloVacio
                      ? "Falta el título del menú."
                      : sinOpciones
                        ? "Escribí al menos una opción: un menú sin opciones no se guarda."
                        : "Hay un submenú sin sub-opciones: ponele al menos una, o pasalo a Texto."}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={resetForm} className="h-8 text-xs text-slate-300">Cancelar</Button>
                  <Button onClick={onSubmit} size="sm" disabled={!puedeGuardar} className="h-8 text-xs bg-gradient-to-r from-violet-400 to-violet-500 hover:from-violet-300 hover:to-violet-400 text-slate-950 font-semibold">
                    {guardando ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.03]" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/[0.06] p-12 text-center">
            <Layers className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">{search ? "Sin resultados" : "Sin menús aún"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map((m, idx) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
                <Card className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-md overflow-hidden shadow-xl shadow-black/30 hover:border-white/[0.12] transition-all">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                      <span className="text-xs font-bold text-violet-400 truncate">{m.menu_config?.title || "Sin título"}</span>
                      <span className="ml-auto text-[10px] text-slate-500">{m.menu_config?.buttons?.length || 0} opciones</span>
                      <Badge variant="default" className={m.is_active ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 text-[10px]" : "bg-rose-400/10 text-rose-400 border-rose-400/20 text-[10px]"}>
                        {m.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-2">
                      {m.menu_config?.description && <p className="text-sm text-slate-300">{m.menu_config.description}</p>}
                      {m.menu_config?.buttons && m.menu_config.buttons.length > 0 && (
                        <div className="p-2.5 bg-violet-500/[0.04] rounded-xl border border-violet-400/10">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-1.5">Botones</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.menu_config.buttons.map((b: BotonMenu) => {
                              const esSubmenu = !!b.target_id && menus.some((x) => x.id === b.target_id);
                              return (
                                <span key={b.id} className="text-[10px] px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-400/15">
                                  {esSubmenu && "↳ "}
                                  {b.text}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02] flex gap-1">
                      {editando?.id === m.id ? (
                        <>
                          <Button onClick={onSubmit} size="icon" disabled={!puedeGuardar} className="h-7 w-7 bg-emerald-500 hover:bg-emerald-400 text-slate-950" title="Guardar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={resetForm} className="h-7 w-7 text-slate-300" title="Cancelar">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(m)} className="h-7 w-7 text-slate-400 hover:text-violet-400 hover:bg-violet-400/10" title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => toggle(m.id)} className="h-7 w-7 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10" title={m.is_active ? "Pausar" : "Activar"}>
                            {m.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10" onClick={() => remove(m.id)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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