export default function CommunityLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="flex items-center justify-between border-b border-[#2a3942] bg-[#202c33] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-[#2a3942]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-[#2a3942]" />
            <div className="h-2.5 w-40 animate-pulse rounded bg-[#2a3942]/50" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-7 w-24 animate-pulse rounded-full bg-[#2a3942]" />
        <div className="h-7 w-28 animate-pulse rounded-full bg-[#2a3942]" />
      </div>
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#2a3942] bg-[#202c33] p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-[#2a3942]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 animate-pulse rounded bg-[#2a3942]" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#2a3942]/50" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-[#2a3942]/50" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-[#2a3942]/50" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
