"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Instance } from "@/lib/supabase/types";
import { ClockIcon, InboxIcon, LoaderIcon } from "@/components/icons";

interface LogEntry {
  id: string;
  incoming_phone: string;
  incoming_message: string;
  matched_keyword: string | null;
  auto_responses: { keyword: string | null; regex_pattern: string | null; response_text: string } | null;
  sent_at: string;
}

export default function LogsPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const loadInstances = useCallback(async () => {
    const res = await fetch("/api/instances");
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

    const res = await fetch(`/api/logs?instanceId=${selectedInstance}&limit=50`);
    const payload = await res.json();

    if (payload.status === "success") {
      setLogs(payload.data.logs);
      setTotal(payload.data.total);
    }
    setLoading(false);
  }, [selectedInstance]);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-wa-border bg-wa-header px-4 py-2.5">
        <ClockIcon className="h-5 w-5 text-[#53bdeb]" />
        <span className="text-[0.9375rem] font-normal text-wa-text">Logs de actividad</span>
        {total > 0 && (
          <span className="rounded-full bg-[#53bdeb]/10 px-2 py-0.5 text-[10px] font-medium text-[#53bdeb]">
            {total} registros
          </span>
        )}
      </div>

      {/* Instance selector */}
      {instances.length > 1 && (
        <div className="border-b border-wa-border px-4 py-2">
          <select
            value={selectedInstance || ""}
            onChange={(event) => setSelectedInstance(event.target.value)}
            className="input-field w-full max-w-xs text-sm"
          >
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.instance_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedInstance ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ClockIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">Crea una instancia primero</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <InboxIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">Sin actividad registrada</p>
            <p className="max-w-xs text-xs text-wa-text-secondary/60">
              Los registros aparecerán cuando se activen las auto-respuestas
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border-b border-wa-border/50 px-4 py-3 transition hover:bg-wa-hover/30"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-wa-text">{log.incoming_phone}</span>
                  <span className="shrink-0 text-[10px] text-wa-text-secondary/50">
                    {new Date(log.sent_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-wa-text-secondary">
                  Mensaje: <span className="text-wa-text">{log.incoming_message}</span>
                </p>
                {log.auto_responses && (
                  <p className="mt-0.5 text-xs text-[#00a884]">
                    Match: &quot;{log.matched_keyword}&quot; → {log.auto_responses.response_text.slice(0, 60)}...
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
