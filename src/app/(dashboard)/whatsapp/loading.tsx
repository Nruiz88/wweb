export default function WhatsAppLoading() {
  return (
    <div className="flex h-full flex-col bg-[#0b141a]">
      <div className="border-b border-[#2a3942] bg-[#202c33] px-4 py-2.5">
        <div className="h-4 w-28 animate-pulse rounded bg-[#2a3942]" />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="mx-auto max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#202c33] ring-4 ring-[#2a3942]/30">
            <div className="h-12 w-12 animate-pulse rounded-full bg-[#2a3942]" />
          </div>
          <div className="space-y-2">
            <div className="mx-auto h-5 w-40 animate-pulse rounded bg-[#2a3942]" />
            <div className="mx-auto h-3 w-48 animate-pulse rounded bg-[#2a3942]/50" />
          </div>
          <div className="mx-auto h-12 w-full animate-pulse rounded-xl bg-[#00a884]/20" />
        </div>
      </div>
    </div>
  );
}
