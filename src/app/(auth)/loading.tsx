export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111b21]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-[#00a884]/20" />
          <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
        </div>
        <p className="text-sm text-gray-500">Cargando...</p>
      </div>
    </div>
  );
}
