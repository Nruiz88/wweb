import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111b21] px-6 text-center">
      <div className="relative mb-8">
        <div className="absolute -inset-8 rounded-full bg-[#00a884]/10 blur-2xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5 ring-4 ring-[#00a884]/10">
          <span className="text-4xl font-extrabold text-[#00a884]">?</span>
        </div>
      </div>

      <h1 className="text-6xl font-extrabold text-white">404</h1>
      <p className="mt-3 text-lg text-gray-300">Página no encontrada</p>
      <p className="mt-1 max-w-sm text-sm text-gray-500">
        Lo siento, no pudimos encontrar la página que buscás. Puede que haya sido movida o ya no exista.
      </p>

      <a
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:bg-[#00a884]/90 hover:shadow-xl"
      >
        Volver al inicio
      </a>

      <div className="mt-12">
        <Logo size="sm" className="opacity-40" />
      </div>
    </div>
  );
}
