import { MessageCircleIcon, ZapIcon, ShieldIcon, CheckIcon, ArrowRightIcon } from "@/components/icons";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#111b21]">
      {/* Navbar */}
      <nav className="flex items-center justify-between border-b border-wa-border bg-[#202c33] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
            <MessageCircleIcon className="h-5 w-5" />
          </span>
          <span className="text-base font-bold text-white">Bot WhatsApp</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-wa-text-secondary transition hover:text-white">
            Iniciar sesion
          </a>
          <a href="/register" className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00a884]/90">
            Registrarse
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center px-6 py-20 text-center">
        <span className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#00a884]/15 text-[#00a884]">
          <MessageCircleIcon className="h-10 w-10" />
        </span>
        <h1 className="max-w-2xl text-3xl font-bold text-white sm:text-5xl">
          Automatiza tu WhatsApp
          <br />
          <span className="text-[#00a884]">en 3 pasos simples</span>
        </h1>
        <p className="mt-5 max-w-lg text-base text-wa-text-secondary sm:text-lg">
          Crea respuestas automaticas para tu negocio. Sin programar, sin complicaciones. Tu bot responde 24/7.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/register"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#00a884]/90"
          >
            Empezar gratis
            <ArrowRightIcon className="h-4 w-4" />
          </a>
          <a
            href="/login"
            className="flex items-center justify-center gap-2 rounded-xl border border-wa-border px-8 py-3.5 text-sm font-medium text-wa-text-secondary transition hover:bg-[#2a3942] hover:text-white"
          >
            Ya tengo cuenta
          </a>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-wa-border bg-[#202c33] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">Como funciona</h2>
          <p className="mt-2 text-center text-sm text-wa-text-secondary">Tres pasos y tu bot esta funcionando</p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-2xl border border-wa-border bg-[#111b21] p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884]/15 text-sm font-bold text-[#00a884]">
                1
              </div>
              <h3 className="text-base font-semibold text-white">Conecta tu WhatsApp</h3>
              <p className="mt-2 text-sm text-wa-text-secondary">
                Escanea un codigo QR desde tu telefono y listo
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-wa-border bg-[#111b21] p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6a44e]/15 text-sm font-bold text-[#e6a44e]">
                2
              </div>
              <h3 className="text-base font-semibold text-white">Crea respuestas</h3>
              <p className="mt-2 text-sm text-wa-text-secondary">
                Define que responder cuando llegue un mensaje
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-wa-border bg-[#111b21] p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#53bdeb]/15 text-sm font-bold text-[#53bdeb]">
                3
              </div>
              <h3 className="text-base font-semibold text-white">Tu bot activo</h3>
              <p className="mt-2 text-sm text-wa-text-secondary">
                Respondiendo mensajes automaticamente 24/7
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-bold text-white sm:text-2xl">Todo lo que necesitas</h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-wa-border bg-[#202c33] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/15 text-[#00a884]">
                <ZapIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Respuestas automaticas</p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">Por palabra clave o expresion regular</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-wa-border bg-[#202c33] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/15 text-[#00a884]">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Multi-usuario</p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">Cada usuario con su propia instancia</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-wa-border bg-[#202c33] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/15 text-[#00a884]">
                <CheckIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Sin programar</p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">Interfaz simple para cualquier persona</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-wa-border bg-[#202c33] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/15 text-[#00a884]">
                <MessageCircleIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">24/7 activo</p>
                <p className="mt-0.5 text-xs text-wa-text-secondary">Tu bot nunca se apaga</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-wa-border bg-[#202c33] px-6 py-16 text-center">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Empeza hoy</h2>
        <p className="mt-2 text-sm text-wa-text-secondary">Creá tu cuenta gratis y activá tu bot en minutos</p>
        <a
          href="/register"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#00a884]/90"
        >
          Crear cuenta gratis
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-wa-border bg-[#111b21] px-6 py-8 text-center">
        <p className="text-xs text-wa-text-secondary/50">
          Bot WhatsApp &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
