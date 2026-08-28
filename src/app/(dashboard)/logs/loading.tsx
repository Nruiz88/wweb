export default function LogsLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="flex items-center justify-between border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-4 w-20 animate-pulse rounded bg-[#2a3942]" />
      </div>
      <div className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-[#2a3942]/50 bg-[#202c33] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-[#2a3942]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-[#2a3942]" />
                </div>
                <div className="h-2.5 w-16 animate-pulse rounded bg-[#2a3942]/50" />
              </div>
              <div className="mt-3 flex items-start gap-2">
                <div className="mt-0.5 h-5 w-5 animate-pulse rounded bg-[#2a3942]" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-[#2a3942]/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
