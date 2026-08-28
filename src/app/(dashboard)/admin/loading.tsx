export default function AdminLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="flex items-center gap-3 border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-5 w-5 animate-pulse rounded bg-[#2a3942]" />
        <div className="h-4 w-28 animate-pulse rounded bg-[#2a3942]" />
      </div>
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Stats grid skeleton */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[#2a3942] bg-[#202c33] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 animate-pulse rounded-xl bg-[#2a3942]" />
                  <div className="space-y-1.5">
                    <div className="h-6 w-12 animate-pulse rounded bg-[#2a3942]" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-[#2a3942]/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="rounded-2xl border border-[#2a3942] bg-[#202c33] p-4">
            <div className="mb-3 h-4 w-40 animate-pulse rounded bg-[#2a3942]" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-[#0b141a]/50 p-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-[#2a3942]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[#2a3942]" />
                    <div className="h-2 w-1/4 animate-pulse rounded bg-[#2a3942]/50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
