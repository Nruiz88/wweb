export default function CalendarLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="flex items-center justify-between border-b border-[#2a3942] bg-[#202c33] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-[#2a3942]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-[#2a3942]" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-[#2a3942]/50" />
          </div>
        </div>
        <div className="h-8 w-24 animate-pulse rounded-lg bg-[#2a3942]" />
      </div>
      <div className="flex gap-2 border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-7 w-16 animate-pulse rounded-full bg-[#2a3942]" />
        ))}
      </div>
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {[1, 2].map((i) => (
            <div key={i}>
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-[#2a3942]/50" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="rounded-xl border border-[#2a3942] bg-[#202c33] p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 animate-pulse rounded-lg bg-[#2a3942]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-24 animate-pulse rounded bg-[#2a3942]" />
                        <div className="h-2.5 w-32 animate-pulse rounded bg-[#2a3942]/50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
