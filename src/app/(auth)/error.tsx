"use client";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111b21] px-6 text-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <span className="text-3xl">⚠️</span>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white">Error de autenticación</h1>
        <p className="mt-2 text-sm text-gray-400">
          {error.message || "Hubo un problema al procesar tu sesión."}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#00a884] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:bg-[#00a884]/90"
          >
            Intentar de nuevo
          </button>
          <a
            href="/login"
            className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            Volver al login
          </a>
        </div>
      </div>
    </div>
  );
}
