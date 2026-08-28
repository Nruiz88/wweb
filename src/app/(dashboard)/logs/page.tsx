"use client";

import { useCallback, useEffect, useState } from "react";
import type { Instance } from "@/lib/supabase/types";
import { ClockIcon, InboxIcon, LoaderIcon, MessageCircleIcon, ZapIcon } from "@/components/icons";

interface LogEntry {
  id: string;
  incoming_phone: string;
  incoming_message: string;
  matched_keyword: string | null;
  auto_responses: { keyword: string | null; regex_pattern: string | null; response_text: string } | null;
  sent_at: string;
}

// Log entry card
function LogCard({ log }: { log: LogEntry }) {
  const time = new Date(log.sent_at);
  const timeStr = time.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = time.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

  return (
    <div className="group rounded-2xl border border-wa-border/50 bg-wa-header p-4 transition-all hover:border-wa-border hover:shadow-md hover:shadow-black/10">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#53bdeb]/10 text-[10px] font-bold text-[#53bdeb]">
            {log.incoming_phone?.slice(-2) || "?"}
          </div>
          <span className="text-xs font-medium text-wa-text">{log.incoming_phone}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-wa-text-secondary/50">
          <ClockIcon className="h-3 w-3" />
          <span>{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* Message */}
      <div className="mt-3 flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#202c33]">
          <MessageCircleIcon className="h-3 w-3 text-wa-text-secondary/40" />
        </div>
        <p className="text-xs text-wa-text-secondary line-clamp-2">{log.incoming_message}</p>
      </div>

      {/* Match */}
      {log.auto_responses && (
        <div className="mt-2 flex items-start gap-2">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#00a884]/10">
            <ZapIcon className="h-3 w-3 text-[#00a884]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-[#00a884]">
              Match: &quot;{log.matched_keyword}&quot;
            </p>
            <p className="text-[10px] text-wa-text-secondary/50 line-clamp-1">
              {log.auto_responses.response_text.slice(0, 80)}
            </p>
          </div>
        </div>
      )}
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

  // Reset page when switching instances
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

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-normal text-wa-text">Actividad</span>
          {total > 0 && (
            <span className="rounded-full bg-[#53bdeb]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#53bdeb]">
              {total}
            </span>
          )}
        </div>
        {instances.length > 1 && (
          <select
            value={selectedInstance || ""}
            onChange={(e) => setSelectedInstance(e.target.value)}
            className="rounded-lg border border-wa-border bg-wa-header px-3 py-1.5 text-xs text-wa-text-secondary focus:border-[#00a884] focus:outline-none"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>{inst.instance_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedInstance ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-wa-header ring-4 ring-wa-border/30">
              <ClockIcon className="h-10 w-10 text-wa-text-secondary/20" />
            </div>
            <p className="text-sm text-wa-text-secondary">Crea una instancia primero</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-wa-header ring-4 ring-wa-border/30">
              <InboxIcon className="h-10 w-10 text-wa-text-secondary/20" />
            </div>
            <div>
              <p className="text-base font-semibold text-wa-text">Sin actividad</p>
              <p className="mt-1 max-w-xs text-sm text-wa-text-secondary">
                Los registros apareceran cuando se activen las auto-respuestas
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {logs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-wa-border bg-wa-header px-3 py-1.5 text-xs font-medium text-wa-text-secondary hover:border-wa-border/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-wa-text-secondary">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-wa-border bg-wa-header px-3 py-1.5 text-xs font-medium text-wa-text-secondary hover:border-wa-border/80 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
