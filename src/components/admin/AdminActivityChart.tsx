"use client";

import { BarChart3, TrendingUp, Hash } from "lucide-react";

interface ActivityPayload {
  series: { date: string; label: string; responses: number; newUsers: number }[];
  topKeywords: { keyword: string; count: number }[];
}

export default function AdminActivityChart({ activity }: { activity: ActivityPayload }) {
  const maxResponses = Math.max(...activity.series.map(s => s.responses), 1);
  const totalResponses = activity.series.reduce((a, b) => a + b.responses, 0);
  const totalNewUsers = activity.series.reduce((a, b) => a + b.newUsers, 0);

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5">
              <TrendingUp className="h-5 w-5 text-[#00a884]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-wa-text tracking-tight">{totalResponses}</p>
              <p className="text-[11px] text-wa-text-secondary/60 font-medium">Respuestas totales</p>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#53bdeb]/20 to-[#53bdeb]/5">
              <BarChart3 className="h-5 w-5 text-[#53bdeb]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-wa-text tracking-tight">{totalNewUsers}</p>
              <p className="text-[11px] text-wa-text-secondary/60 font-medium">Usuarios nuevos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5">
            <BarChart3 className="h-4.5 w-4.5 text-[#00a884]" />
          </div>
          <h3 className="text-sm font-bold text-wa-text tracking-tight">Actividad por día</h3>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {activity.series.map((s, i) => {
            const h = Math.max(4, (s.responses / maxResponses) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full relative" style={{ height: `${h}%` }}>
                  <div className="absolute inset-0 rounded-t-lg bg-gradient-to-t from-[#00a884] to-[#00a884]/60 transition-all duration-300 group-hover:from-[#00a884] group-hover:to-[#25d366] group-hover:shadow-lg group-hover:shadow-[#00a884]/20" />
                </div>
                <span className="text-[8px] text-wa-text-secondary/30 font-medium truncate w-full text-center">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top keywords */}
      {activity.topKeywords.length > 0 && (
        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-wa-header to-wa-header/80 p-5 shadow-xl shadow-black/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6a44e]/20 to-[#e6a44e]/5">
              <Hash className="h-4.5 w-4.5 text-[#e6a44e]" />
            </div>
            <h3 className="text-sm font-bold text-wa-text tracking-tight">Top keywords</h3>
          </div>
          <div className="space-y-2">
            {activity.topKeywords.slice(0, 8).map((kw, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 transition-all hover:border-white/10 hover:bg-white/[0.04]">
                <span className="text-xs font-bold text-wa-text">{kw.keyword}</span>
                <span className="text-[10px] font-bold text-[#00a884]">{kw.count} usos</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
