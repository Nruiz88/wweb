export default function DashboardHomeLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-4 w-16 animate-pulse rounded bg-[#2a3942]" />
      </div>
      <div className="flex flex-1 items-start justify-center p-4 sm:p-6">
        <div className="mx-auto max-w-lg w-full space-y-5">
          {/* Status banner skeleton */}
          <div className="rounded-2xl border border-[#2a3942] bg-[#202c33] p-5">
            <div className="flex flex-col items-center gap-3">
              <div className="h-20 w-20 animate-pulse rounded-full bg-[#2a3942]" />
              <div className="space-y-1.5 text-center">
                <div className="mx-auto h-4 w-40 animate-pulse rounded bg-[#2a3942]" />
                <div className="mx-auto h-3 w-48 animate-pulse rounded bg-[#2a3942]/50" />
              </div>
            </div>
          </div>
          {/* Progress skeleton */}
          <div className="rounded-xl border border-[#2a3942] bg-[#202c33] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="h-2.5 w-16 animate-pulse rounded bg-[#2a3942]/50" />
              <div className="h-2.5 w-6 animate-pulse rounded bg-[#2a3942]/50" />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#0b141a]">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[#00a884]/30" />
            </div>
          </div>
          {/* Step skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-[#2a3942] bg-[#202c33] p-4">
              <div className="h-12 w-12 animate-pulse shrink-0 rounded-xl bg-[#2a3942]" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 animate-pulse rounded bg-[#2a3942]" />
                <div className="h-2.5 w-48 animate-pulse rounded bg-[#2a3942]/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
