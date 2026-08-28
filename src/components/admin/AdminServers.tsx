"use client";

import { MessageCircleIcon } from "@/components/icons";

function displayHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

interface InstanceInfo {
  id: string;
  instance_name: string;
  status: string;
  user_count: number;
  users: { id: string; email: string; full_name: string | null }[];
}

interface ServerCapacity {
  server_url: string;
  instance_count: number;
  max_instances: number;
  remaining: number;
  instances: InstanceInfo[];
}

export default function AdminServers({ capacities }: { capacities: ServerCapacity[] }) {
  if (capacities.length === 0) return null;

  return (
    <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-wa-text">Servidores (Railway) y cupos</h3>
        <span className="text-[10px] text-wa-text-secondary/50">maximo 10 instancias por servidor</span>
      </div>

      <div className="mt-3 space-y-3">
        {capacities.map((server) => {
          const pct = Math.min(100, (server.instance_count / server.max_instances) * 100);
          const full = server.remaining === 0;
          return (
            <div key={server.server_url} className="rounded-xl border border-wa-border/50 bg-wa-panel/50 p-4 transition hover:border-wa-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/10 text-[#00a884]">
                    <MessageCircleIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-wa-text">Servidor</p>
                    <p className="truncate text-[10px] text-wa-text-secondary/50">{displayHost(server.server_url)}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${full ? "bg-red-500/10 text-red-400" : "bg-[#00a884]/10 text-[#00a884]"}`}>
                  {full ? "Sin cupo" : `${server.remaining} cupos`}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-wa-text-secondary/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: full ? "#ef4444" : "#00a884" }} />
              </div>
              <p className="mt-1 text-[10px] text-wa-text-secondary/60">
                {server.instance_count}/{server.max_instances} instancias (WhatsApp) en este servidor
              </p>

              <div className="mt-3 space-y-2">
                {server.instances.map((inst) => (
                  <div key={inst.id} className="rounded-lg border border-wa-border/40 bg-wa-header/60 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-wa-text">{inst.instance_name}</p>
                      <span className="text-[10px] text-wa-text-secondary/60">
                        {inst.status === "open" ? "Conectada" : "Desconectada"}
                      </span>
                    </div>
                    {inst.users.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {inst.users.map((u) => (
                          <span key={u.id} title={u.full_name || undefined} className="rounded-full border border-wa-border bg-wa-header px-2.5 py-1 text-[10px] text-wa-text-secondary">
                            {u.email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-wa-text-secondary/40">Sin usuario asignado</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
