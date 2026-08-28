"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111b21] px-6 text-center">
      <div className="relative mb-8">
        <div className="absolute -inset-8 rounded-full bg-red-500/10 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/20 to-red-500/5 ring-4 ring-red-500/10">
          <span className="text-4xl">💥</span>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-400">
        Ocurrió un error inesperado. Si persiste, contacta al administrador.
      </p>

      {error.digest && (
        <p className="mt-3 rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[10px] text-gray-500">
          {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:bg-[#00a884]/90 hover:shadow-xl"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
