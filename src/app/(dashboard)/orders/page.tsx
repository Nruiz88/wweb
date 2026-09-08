"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ClipboardList, Check, CheckCircle2, Clock3, Package } from "lucide-react";
import type { Order } from "@/lib/supabase/types";

export default function OrdersPage() {
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  // loading derivado: true hasta que los datos se cargan para el instanceId actual
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "completed" | "all">("pending");

  const load = useCallback(async () => {
    if (!instanceId) return;
    const res = await fetch(`/api/orders?instanceId=${instanceId}&date=today`);
    const p = await res.json();
    if (p.status === "success") setOrders(p.data);
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

  async function handleComplete(id: string) {
    const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed" }) });
    const p = await res.json();
    if (p.status === "success") { toast.success("Pedido completado"); load(); } else toast.error(p.error);
  }

  const filtered = orders.filter(o => filter === "all" ? true : o.status === filter);
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const completedCount = orders.filter(o => o.status === "completed").length;

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/25">
              <ClipboardList className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Pedidos del día</h1>
            <p className="text-xs text-slate-400 mt-0.5">Seguimiento de órdenes en tiempo real</p>
          </div>
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-0.5">
            {(["pending","completed","all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${filter === f ? "bg-gradient-to-br from-cyan-400/20 to-violet-400/20 text-cyan-300 border border-cyan-400/30 shadow-sm" : "text-slate-400 hover:text-slate-300"}`}>
                {f === "pending" ? "Pendientes" : f === "completed" ? "Terminados" : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 shadow-xl shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hoy</p>
          <p className="text-xl font-extrabold text-slate-100 mt-0.5">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 shadow-xl shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pendientes</p>
          <p className="text-xl font-extrabold text-amber-400 mt-0.5">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 shadow-xl shadow-black/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Completados</p>
          <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{completedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-violet-500/10 to-violet-600/5 p-3 shadow-xl shadow-violet-900/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">Progreso</p>
          <p className="text-xl font-extrabold text-violet-300 mt-0.5">{orders.length ? Math.round((completedCount / orders.length) * 100) : 0}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-2xl bg-white/[0.03]" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/[0.06] p-10 text-center">
            <Package className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Sin pedidos {filter === "pending" ? "pendientes" : filter === "completed" ? "terminados" : ""} hoy</p>
          </div>
        ) : (
          filtered.map((o, idx) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-md shadow-lg shadow-black/20 hover:border-white/[0.12] transition-all group">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg ${o.status === "completed" ? "bg-gradient-to-br from-emerald-400/15 to-emerald-600/10 text-emerald-400 shadow-emerald-400/20" : "bg-gradient-to-br from-amber-400/15 to-amber-600/10 text-amber-400 shadow-amber-400/20"}`}>
                    {o.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate text-slate-100">{o.option_label}</p>
                      <Badge variant={o.status === "pending" ? "outline" : "default"} className={o.status === "pending" ? "text-amber-400 border-amber-400/30 text-[10px] bg-amber-400/5" : "text-emerald-400 bg-emerald-400/10 text-[10px] border-0"}>{o.status === "pending" ? "Pendiente" : "Completado"}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{o.customer_name || o.customer_phone || "Sin datos"} · <span className="text-slate-500">{new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-cyan-400">${(o.price_cents / 100).toFixed(2)}</p>
                  </div>
                  {o.status === "pending" && (
                    <Button onClick={() => handleComplete(o.id)} size="sm" className="h-8 rounded-xl gap-1 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-400/20">
                      <Check className="h-3.5 w-3.5" />Listo
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}