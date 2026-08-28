"use client";

import { UsersIcon, MessageCircleIcon, ZapIcon, ClockIcon } from "@/components/icons";

interface Stats {
  totalUsers: number;
  totalInstances: number;
  connectedInstances: number;
  totalAutoResponses: number;
  activeAutoResponses: number;
  totalLogs: number;
  recentLogs24h: number;
  recentUsers7d: number;
  totalAppointments: number;
  pendingAppointments: number;
  totalGroupSettings: number;
  totalBroadcasts: number;
  completedBroadcasts: number;
}

function StatCard({ icon, value, label, accent, sub }: {
  icon: React.ReactNode; value: number; label: string; accent: string; sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-4 transition-all hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20" style={{ backgroundColor: accent }} />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${accent}15`, color: accent }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-wa-text">{value}</p>
          <p className="text-[11px] text-wa-text-secondary">{label}</p>
        </div>
      </div>
      {sub && <p className="relative mt-2 text-[10px] font-medium" style={{ color: accent }}>{sub}</p>}
    </div>
  );
}

export default function AdminStats({ stats }: { stats: Stats }) {
  return (
    <>
      {/* Core Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<UsersIcon className="h-5 w-5" />} value={stats.totalUsers} label="Usuarios" accent="#53bdeb" sub={stats.recentUsers7d > 0 ? `+${stats.recentUsers7d} esta semana` : undefined} />
        <StatCard icon={<MessageCircleIcon className="h-5 w-5" />} value={stats.totalInstances} label="Instancias" accent="#00a884" sub={`${stats.connectedInstances} conectada${stats.connectedInstances !== 1 ? "s" : ""}`} />
        <StatCard icon={<ZapIcon className="h-5 w-5" />} value={stats.totalAutoResponses} label="Auto-respuestas" accent="#e6a44e" sub={`${stats.activeAutoResponses} activa${stats.activeAutoResponses !== 1 ? "s" : ""}`} />
        <StatCard icon={<ClockIcon className="h-5 w-5" />} value={stats.totalLogs} label="Respuestas enviadas" accent="#00a884" sub={stats.recentLogs24h > 0 ? `+${stats.recentLogs24h} en 24h` : undefined} />
      </div>

      {/* Feature Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={<ClockIcon className="h-5 w-5" />} value={stats.totalAppointments} label="Turnos" accent="#00a884" sub={stats.pendingAppointments > 0 ? `${stats.pendingAppointments} pendiente${stats.pendingAppointments !== 1 ? "s" : ""}` : undefined} />
        <StatCard icon={<UsersIcon className="h-5 w-5" />} value={stats.totalGroupSettings} label="Grupos configurados" accent="#e6a44e" sub="bienvenida + anti-spam" />
        <StatCard icon={<ZapIcon className="h-5 w-5" />} value={stats.totalBroadcasts} label="Broadcasts" accent="#53bdeb" sub={stats.completedBroadcasts > 0 ? `${stats.completedBroadcasts} enviados` : undefined} />
      </div>
    </>
  );
}
