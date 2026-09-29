"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { X, Upload, AlertTriangle, Check, Trash2, ListPlus } from "lucide-react";
import { parsePriceList, formatCents, PRICE_LIST_EXAMPLE } from "@/lib/price-list";
import { cn } from "@/lib/utils";

interface PlannedItem {
  label: string;
  price_cents: number;
  category: string | null;
  raw: string;
  line: number;
  duplicate: boolean;
}

interface Rejected {
  raw: string;
  line: number;
  reason: string;
}

/**
 * Importación masiva del catálogo desde una lista de precios pegada.
 *
 * Dos pasos a propósito:
 *  1. Pegar → se muestra una VISTA PREVIA con lo que se entendió y lo que no.
 *  2. Recién ahí se importa.
 *
 * Importar de una sería la forma más rápida de que alguien suba 40 productos y
 * después descubra que la mitad están mal. Con la vista previa puede sacar lo
 * que no vaya, corregir un precio y recién ahí confirmar.
 *
 * El parseo se hace en el browser (respuesta inmediata, sin esperar al server)
 * y el server vuelve a validar antes de escribir.
 */
export default function BulkImportModal({
  instanceId,
  onClose,
  onImported,
}: {
  instanceId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<"paste" | "preview" | "done">("paste");
  const [text, setText] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [replaceAll, setReplaceAll] = useState(false);
  const [planned, setPlanned] = useState<PlannedItem[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ imported: number; failed: number; skipped: unknown[] } | null>(null);

  // Parseo local para previsualizar al instante, sin ir al server.
  const localPreview = useCallback(() => {
    const cat = defaultCategory.trim() || null;
    const { products, rejected: rej } = parsePriceList(text, cat);
    return {
      products: products.map((p) => ({
        label: p.label,
        price_cents: p.priceCents,
        category: p.category,
        raw: p.raw,
        line: p.line,
        duplicate: false,
      })),
      rejected: rej,
    };
  }, [text, defaultCategory]);

  async function analyze() {
    const { products, rejected: rej } = localPreview();
    if (products.length === 0 && rej.length === 0) {
      toast.error("Pegá tu lista de precios");
      return;
    }
    setBusy(true);
    try {
      // El server además marca los duplicados contra lo que YA existe.
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          text,
          defaultCategory: defaultCategory.trim() || null,
        }),
      });
      const p = await res.json();
      if (p.status !== "success") {
        toast.error(p.error || "No pude leer la lista");
        return;
      }
      setPlanned(p.data.items as PlannedItem[]);
      setRejected(p.data.rejected as Rejected[]);
      setStep("preview");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    const toImport = planned.filter((p) => !p.duplicate);
    if (toImport.length === 0) {
      toast.error("No hay productos nuevos para importar");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          items: toImport.map((p) => ({
            label: p.label,
            price_cents: p.price_cents,
            category: p.category,
          })),
          replaceAll,
        }),
      });
      const p = await res.json();
      if (p.status !== "success") {
        toast.error(p.error || "No pude importar");
        return;
      }
      setSummary({ imported: p.data.imported, failed: p.data.failed?.length ?? 0, skipped: p.data.skipped ?? [] });
      setStep("done");
      onImported();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    setPlanned((prev) => prev.filter((_, idx) => idx !== i));
  }

  function editAt(i: number, patch: Partial<PlannedItem>) {
    setPlanned((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  const livePreview = step === "paste" ? localPreview() : null;
  const newCount = planned.filter((p) => !p.duplicate).length;
  const dupCount = planned.filter((p) => p.duplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="flex w-full max-w-2xl max-h-[92vh] flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-wa-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <ListPlus className="h-5 w-5 shrink-0 text-[#00a884]" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-wa-text">Cargar productos de una vez</h2>
            <p className="text-[11px] text-wa-text-secondary/70">
              {step === "paste" && "Pegá tu lista de precios tal cual"}
              {step === "preview" && "Revisá antes de confirmar"}
              {step === "done" && "Listo"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-wa-text-secondary hover:bg-white/5" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Paso 1: pegar */}
        {step === "paste" && (
          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-wa-text-secondary">
                Tu lista de precios
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={PRICE_LIST_EXAMPLE}
                rows={10}
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 font-mono text-xs text-wa-text placeholder:text-wa-text-secondary/30 focus:border-[#00a884]/50 focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-wa-text-secondary">
                  Categoría para todos <span className="font-normal opacity-60">(opcional)</span>
                </label>
                <Input
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  placeholder="Ej: Comidas"
                  className="h-9 bg-white/[0.04] border-white/[0.08] text-sm text-wa-text"
                />
              </div>
              <label className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="h-4 w-4 accent-[#00a884]"
                />
                <span className="text-[11px] leading-tight text-wa-text-secondary">
                  Reemplazar el catálogo actual
                  <span className="block opacity-60">Los productos viejos se pausan, no se borran</span>
                </span>
              </label>
            </div>

            {/* Preview en vivo */}
            {livePreview && (livePreview.products.length > 0 || livePreview.rejected.length > 0) && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 flex flex-wrap gap-3 text-[11px]">
                  <span className="font-semibold text-[#00a884]">
                    {livePreview.products.length} producto{livePreview.products.length !== 1 ? "s" : ""} listo{livePreview.products.length !== 1 ? "s" : ""}
                  </span>
                  {livePreview.rejected.length > 0 && (
                    <span className="text-amber-400">
                      {livePreview.rejected.length} línea{livePreview.rejected.length !== 1 ? "s" : ""} sin precio
                    </span>
                  )}
                </div>
                {livePreview.products.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5 text-[11px] text-wa-text-secondary">
                    <span className="truncate">{p.label}</span>
                    <span className="shrink-0 font-semibold text-wa-text">{formatCents(p.price_cents)}</span>
                  </div>
                ))}
                {livePreview.products.length > 4 && (
                  <p className="mt-1 text-[10px] opacity-60">y {livePreview.products.length - 4} más…</p>
                )}
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-wa-text-secondary/60">
              Aceptá <code className="text-wa-text-secondary">-</code> o <code className="text-wa-text-secondary">*</code> al principio,
              el precio al final con <code className="text-wa-text-secondary">$</code>, guiones o dos puntos, y separados por miles
              (<code className="text-wa-text-secondary">1.200,50</code>). Con <code className="text-wa-text-secondary">|</code> le pás la
              categoría: <code className="text-wa-text-secondary">Café | Bebidas | 2500</code>.
            </p>
          </div>
        )}

        {/* Paso 2: vista previa */}
        {step === "preview" && (
          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-lg bg-[#00a884]/15 px-2 py-1 font-semibold text-[#00a884]">
                {newCount} para importar
              </span>
              {dupCount > 0 && (
                <span className="rounded-lg bg-amber-500/15 px-2 py-1 font-semibold text-amber-400">
                  {dupCount} ya existen
                </span>
              )}
              {rejected.length > 0 && (
                <span className="rounded-lg bg-red-500/15 px-2 py-1 font-semibold text-red-400">
                  {rejected.length} sin precio
                </span>
              )}
            </div>

            {newCount === 0 && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
                Todos los productos que pegaste ya están en tu catálogo. Si querés recargarlos igual, sacá los tildes de "ya existen".
              </p>
            )}

            <div className="space-y-1.5">
              {planned.map((p, i) => (
                <div
                  key={`${p.line}-${i}`}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                    p.duplicate
                      ? "border-amber-500/30 bg-amber-500/5 opacity-70"
                      : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <Input
                    value={p.label}
                    onChange={(e) => editAt(i, { label: e.target.value })}
                    disabled={p.duplicate}
                    className="h-8 min-w-0 flex-1 border-white/10 bg-white/[0.04] text-xs text-wa-text"
                  />
                  <Input
                    type="number"
                    value={(p.price_cents / 100).toString()}
                    onChange={(e) => editAt(i, { price_cents: Math.round(Number(e.target.value) * 100) })}
                    disabled={p.duplicate}
                    className="h-8 w-24 shrink-0 border-white/10 bg-white/[0.04] text-xs text-wa-text"
                  />
                  {p.duplicate ? (
                    <span className="shrink-0 text-[10px] font-semibold text-amber-400">ya existe</span>
                  ) : (
                    <button
                      onClick={() => removeAt(i)}
                      className="shrink-0 rounded-lg p-1.5 text-wa-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      aria-label={`Sacar ${p.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {rejected.length > 0 && (
              <details className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <summary className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {rejected.length} línea{rejected.length !== 1 ? "s" : ""} que no pude leer
                </summary>
                <ul className="mt-2 space-y-1">
                  {rejected.map((r, i) => (
                    <li key={i} className="text-[11px] text-amber-300/80">
                      <span className="opacity-60">línea {r.line}:</span> {r.raw} — <em>{r.reason}</em>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Paso 3: listo */}
        {step === "done" && summary && (
          <div className="flex-1 space-y-3 p-4">
            <div className="rounded-xl border border-[#00a884]/30 bg-[#00a884]/10 p-4 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-[#00a884]" />
              <p className="text-sm font-bold text-wa-text">
                {summary.imported} producto{summary.imported !== 1 ? "s" : ""} cargado{summary.imported !== 1 ? "s" : ""}
              </p>
              {summary.failed > 0 && (
                <p className="mt-1 text-[11px] text-amber-400">{summary.failed} no se pudieron guardar</p>
              )}
            </div>
            <p className="text-center text-[11px] text-wa-text-secondary/70">
              Ya están disponibles. Mandale un <strong>menú</strong> por WhatsApp para verlos.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 border-t border-white/10 p-3">
          {step === "paste" && (
            <>
              <Button variant="outline" onClick={onClose} className="flex-1 border-white/10 text-wa-text-secondary">
                Cancelar
              </Button>
              <Button
                onClick={analyze}
                disabled={busy}
                className="flex-1 gap-2 bg-gradient-to-r from-[#00a884] to-[#25d366] text-white font-semibold"
              >
                <Upload className="h-4 w-4" />
                {busy ? "Leyendo…" : "Ver qué se entiende"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("paste")} className="flex-1 border-white/10 text-wa-text-secondary">
                Volver
              </Button>
              <Button
                onClick={confirmImport}
                disabled={busy || newCount === 0}
                className="flex-1 gap-2 bg-gradient-to-r from-[#00a884] to-[#25d366] text-white font-semibold"
              >
                <Upload className="h-4 w-4" />
                {busy ? "Importando…" : `Importar ${newCount}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-[#00a884] to-[#25d366] text-white font-semibold"
            >
              Listo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
