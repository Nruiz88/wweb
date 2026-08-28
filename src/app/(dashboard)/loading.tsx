export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      {/* Header skeleton */}
      <div className="border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-4 w-24 animate-pulse rounded bg-[#2a3942]" />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-lg space-y-4">
          {/* Card skeletons */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-[#2a3942] bg-[#202c33] p-4"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-[#2a3942]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#2a3942]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#2a3942]/50" />
                </div>
              </div>
            </div>
          ))}

          {/* Centered spinner */}
          <div className="flex justify-center pt-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}
