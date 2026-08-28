export default function ProfileLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-4 w-20 animate-pulse rounded bg-[#2a3942]" />
      </div>
      <div className="flex-1 p-4 sm:p-6">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 animate-pulse rounded-full bg-[#2a3942]" />
          </div>
          <div className="space-y-3 rounded-2xl border border-[#2a3942] bg-[#202c33] p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-2.5 w-24 animate-pulse rounded bg-[#2a3942]/50" />
                <div className="h-10 animate-pulse rounded-xl bg-[#0b141a]" />
              </div>
            ))}
          </div>
          <div className="mx-auto h-10 w-40 animate-pulse rounded-xl bg-[#00a884]/30" />
        </div>
      </div>
    </div>
  );
}
