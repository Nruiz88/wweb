"use client";

interface ActivityPayload {
  series: { date: string; label: string; responses: number; newUsers: number }[];
  topKeywords: { keyword: string; count: number }[];
}

export default function AdminActivity({ activity }: { activity: ActivityPayload }) {
  return (
    <div className="rounded-2xl border border-wa-border bg-wa-header p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-wa-text">Actividad (ultimos 7 dias)</h3>
        <span className="text-[10px] text-wa-text-secondary/50">respuestas enviadas + usuarios nuevos</span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2 sm:gap-3">
        {activity.series.map((day) => {
          const maxResponses = Math.max(...activity.series.map((s) => s.responses), 1);
          const height = Math.max(4, Math.round((day.responses / maxResponses) * 100));
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-28 w-full items-end justify-center rounded-lg bg-wa-panel/50 p-1">
                <div
                  className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[#00a884] to-[#25d366] transition-all"
                  style={{ height: `${height}%`, opacity: day.responses === 0 ? 0.15 : 0.9 }}
                  title={`${day.responses} respuestas`}
                />
              </div>
              <span className="text-[10px] font-medium text-wa-text-secondary">{day.responses}</span>
              <span className="text-[9px] uppercase text-wa-text-secondary/50">{day.label}</span>
            </div>
          );
        })}
      </div>

      {activity.topKeywords.length > 0 && (
        <div className="mt-4 border-t border-wa-border pt-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-wa-text-secondary/50">
            Palabras clave mas usadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activity.topKeywords.map((k) => (
              <span
                key={k.keyword}
                className="inline-flex items-center gap-1.5 rounded-full border border-wa-border bg-wa-panel/50 px-2.5 py-1 text-[10px] text-wa-text-secondary"
              >
                {k.keyword}
                <span className="font-semibold text-[#e6a44e]">{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
