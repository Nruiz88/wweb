"use client";

import { MessageCircleIcon } from "@/components/icons";

function displayHost(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

interface InstanceInfo {
  id: string; instance_name: string; status: string; user_count: number;
  users: { id: string; email: string; full_name: string | null }[];
}

interface ServerCapacity {
  server_url: string; instance_count: number; max_instances: number; remaining: number;
  instances: InstanceInfo[];
}

export default function AdminServers({ capacities }: { capacities: ServerCapacity[] }) {
  if (capacities.length === 0) return null;

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <span className="text-sm">🖥️</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-wa-text tracking-tight">Servidores (Railway) y cupos</h3>
            <p className="text-[10px] text-wa-text-secondary/50">máximo 10 instancias por servidor</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {capacities.map((server) => {
          const pct = Math.min(100, (server.instance_count / server.max_instances) * 100);
          const full = server.remaining === 0;
          return (
            <div key={server.server_url} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                    <MessageCircleIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-wa-text">Servidor</p>
                    <p className="truncate text-[10px] text-wa-text-secondary/40">{displayHost(server.server_url)}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${full ? "bg-red-500/15 text-red-400" : "bg-[#00a884]/15 text-[#00a884]"}`}>
                  {full ? "Sin cupo" : `${server.remaining} cupos`}
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: full ? "#ef4444" : "#00a884" }} />
              </div>
              <p className="mt-1.5 text-[10px] text-wa-text-secondary/40 font-medium">
                {server.instance_count}/{server.max_instances} instancias
              </p>

              <div className="mt-3 space-y-2">
                {server.instances.map((inst) => (
                  <div key={inst.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-wa-text">{inst.instance_name}</p>
                      <span className={`text-[10px] font-semibold ${inst.status === "open" ? "text-[#00a884]" : "text-wa-text-secondary/40"}`}>
                        {inst.status === "open" ? "Conectada" : "Desconectada"}
                      </span>
                    </div>
                    {inst.users.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {inst.users.map((u) => (
                          <span key={u.id} title={u.full_name || undefined} className="rounded-full border border-white/5 bg-white/5 px-2.5 py-1 text-[10px] text-wa-text-secondary/60 font-medium">
                            {u.email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-wa-text-secondary/30">Sin usuario asignado</p>
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
