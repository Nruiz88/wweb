"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ClipboardList, Check, CheckCircle2, Clock3, Package } from "lucide-react";
import type { Order } from "@/lib/db/types";

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
    <div className="flex h-full flex-col bg-gradient-to-b from-wa-panel via-wa-panel to-wa-header/40">
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00a884]/25 blur-xl rounded-2xl" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-[#00a884] to-[#25d366] flex items-center justify-center text-white shadow-lg shadow-[#00a884]/25">
              <ClipboardList className="h-6 w-6" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-wa-text">Pedidos del día</h1>
            <p className="text-xs text-wa-text-secondary/60 mt-0.5">Seguimiento de órdenes en tiempo real</p>
          </div>
          <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-0.5">
            {(["pending","completed","all"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${filter === f ? "bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 shadow-sm" : "text-wa-text-secondary/60 hover:text-wa-text"}`}>
                {f === "pending" ? "Pendientes" : f === "completed" ? "Terminados" : "Todos"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-3 shadow-lg shadow-black/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wa-text-secondary/50">Hoy</p>
          <p className="text-xl font-extrabold text-wa-text mt-0.5">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-3 shadow-lg shadow-black/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wa-text-secondary/50">Pendientes</p>
          <p className="text-xl font-extrabold text-[#e6a44e] mt-0.5">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-3 shadow-lg shadow-black/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-wa-text-secondary/50">Completados</p>
          <p className="text-xl font-extrabold text-[#00a884] mt-0.5">{completedCount}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#53bdeb]/10 to-transparent p-3 shadow-lg shadow-black/10">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#53bdeb]">Progreso</p>
          <p className="text-xl font-extrabold text-[#53bdeb] mt-0.5">{orders.length ? Math.round((completedCount / orders.length) * 100) : 0}%</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">{[0,1,2].map(i => <Skeleton key={i} className="h-14 rounded-2xl bg-white/[0.03]" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-white/5 p-10 text-center">
            <Package className="h-8 w-8 text-wa-text-secondary/30 mx-auto mb-2" />
            <p className="text-sm text-wa-text-secondary/60">Sin pedidos {filter === "pending" ? "pendientes" : filter === "completed" ? "terminados" : ""} hoy</p>
          </div>
        ) : (
          filtered.map((o, idx) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="rounded-2xl border border-white/5 bg-gradient-to-b from-wa-header/70 to-transparent shadow-lg shadow-black/10 hover:border-white/10 transition-all group">
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg ${o.status === "completed" ? "bg-gradient-to-br from-[#00a884]/15 to-[#00a884]/5 text-[#00a884] shadow-[#00a884]/10" : "bg-gradient-to-br from-[#e6a44e]/15 to-[#e6a44e]/5 text-[#e6a44e] shadow-[#e6a44e]/10"}`}>
                    {o.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate text-wa-text">{o.option_label}</p>
                      <Badge variant={o.status === "pending" ? "outline" : "default"} className={o.status === "pending" ? "text-[#e6a44e] border-[#e6a44e]/30 text-[10px] bg-[#e6a44e]/10" : "text-[#00a884] bg-[#00a884]/10 text-[10px] border-0"}>{o.status === "pending" ? "Pendiente" : "Completado"}</Badge>
                    </div>
                    <p className="text-xs text-wa-text-secondary/60 truncate">{o.customer_name || o.customer_phone || "Sin datos"} · <span className="text-wa-text-secondary/40">{new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-[#00a884]">${(o.price_cents / 100).toFixed(2)}</p>
                  </div>
                  {o.status === "pending" && (
                    <Button onClick={() => handleComplete(o.id)} size="sm" className="h-8 rounded-xl gap-1 bg-gradient-to-r from-[#00a884] to-[#25d366] hover:from-[#00a884] hover:to-[#25d366] text-white font-semibold shadow-lg shadow-[#00a884]/20">
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