"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Inbox, MessageCircle, Zap, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Instance } from "@/lib/supabase/types";

interface LogEntry {
  id: string;
  incoming_phone: string;
  incoming_message: string;
  matched_keyword: string | null;
  auto_responses: { keyword: string | null; regex_pattern: string | null; response_text: string } | null;
  sent_at: string;
}

function LogCard({ log }: { log: LogEntry }) {
  const time = new Date(log.sent_at);
  const timeStr = time.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -1 }}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-[10px] font-bold text-sky-600">
                {log.incoming_phone?.slice(-2) || "?"}
              </div>
              <span className="text-xs font-medium">{log.incoming_phone}</span>
              {log.matched_keyword ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                  {log.matched_keyword}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">sin match</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {dateStr} {timeStr}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted">
              <MessageCircle className="h-3 w-3 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{log.incoming_message}</p>
          </div>

          {log.auto_responses && (
            <div className="mt-2 flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/10">
                <Zap className="h-3 w-3 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-emerald-600">Match: &quot;{log.matched_keyword}&quot;</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{log.auto_responses.response_text.slice(0, 80)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LogSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const loadInstances = useCallback(async () => {
    const res = await fetch("/api/instances?lite=1");
    const payload = await res.json();
    if (payload.status === "success") {
      setInstances(payload.data);
      if (payload.data.length > 0 && !selectedInstance) {
        setSelectedInstance(payload.data[0].id);
      }
    }
  }, [selectedInstance]);

  const loadLogs = useCallback(async () => {
    if (!selectedInstance) return;
    setLoading(true);
    const res = await fetch(`/api/logs?instanceId=${selectedInstance}&limit=${pageSize}&offset=${page * pageSize}`);
    const payload = await res.json();
    if (payload.status === "success") {
      setLogs(payload.data.logs);
      setTotal(payload.data.total);
    }
    setLoading(false);
  }, [selectedInstance, page]);

  useEffect(() => {
    const t = setTimeout(() => setPage(0), 0);
    return () => clearTimeout(t);
  }, [selectedInstance]);

  useEffect(() => {
    const t = setTimeout(() => void loadInstances(), 0);
    return () => clearTimeout(t);
  }, [loadInstances]);
  useEffect(() => {
    const t = setTimeout(() => void loadLogs(), 0);
    return () => clearTimeout(t);
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.incoming_phone.toLowerCase().includes(q) ||
        l.incoming_message.toLowerCase().includes(q) ||
        l.matched_keyword?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Actividad</span>
          {total > 0 && <Badge variant="secondary" className="text-[10px]">{total}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-48 pl-8 text-xs" />
          </div>
          {instances.length > 1 && (
            <select
              value={selectedInstance || ""}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="h-8 rounded-xl border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.instance_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Mobile search */}
      <div className="border-b bg-card px-4 py-2 sm:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por teléfono o mensaje..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedInstance ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <Clock className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground">Crea una instancia primero</p>
          </div>
        ) : loading ? (
          <LogSkeleton />
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-semibold">{search ? "Sin resultados" : "Sin actividad"}</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {search ? `No hay registros para "${search}"` : "Los registros aparecerán cuando se activen las auto-respuestas"}
              </p>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
            <AnimatePresence>
              {filteredLogs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </AnimatePresence>

            {totalPages > 1 && !search && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">
                  Página {page + 1} de {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                  Siguiente
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
