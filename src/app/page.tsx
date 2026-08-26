import {
  MessageCircleIcon,
  ZapIcon,
  ShieldIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
  ArrowRightIcon,
} from "@/components/icons";
import {
  HeroIllustration,
  StepQRCode,
  StepConfig,
  StepActive,
  FeatureAutoResponses,
  FeatureMultiUser,
  FeatureAnalytics,
  FeatureSecurity,
} from "@/components/illustrations";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#111b21] text-white">
      {/* ===== NAVBAR ===== */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#111b21]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
              <MessageCircleIcon className="h-5 w-5" />
            </span>
            <span className="text-base font-bold">Bot WhatsApp</span>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#como-funciona" className="text-sm text-gray-400 transition hover:text-white">
              Como funciona
            </a>
            <a href="#features" className="text-sm text-gray-400 transition hover:text-white">
              Funcionalidades
            </a>
            <a href="#precios" className="text-sm text-gray-400 transition hover:text-white">
              Precios
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white">
              Iniciar sesion
            </a>
            <a href="/register" className="rounded-lg bg-[#00a884] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#00a884]/90">
              Registrarse
            </a>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00a884]/5 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#00a884]/8 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Text */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00a884]/20 bg-[#00a884]/10 px-4 py-1.5 text-xs font-medium text-[#00a884]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                </span>
                Version 1.0 disponible
              </div>

              <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Automatiza tu
                <br />
                <span className="bg-gradient-to-r from-[#00a884] to-[#25d366] bg-clip-text text-transparent">
                  WhatsApp
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base text-gray-400 sm:text-lg">
                Crea respuestas automaticas para tu negocio. Sin programar, sin complicaciones. Tu bot responde 24/7 mientras vos haces otra cosa.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition hover:bg-[#00a884]/90"
                >
                  Empezar gratis
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
                <a
                  href="#como-funciona"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-sm font-medium text-gray-300 transition hover:border-white/20 hover:bg-white/5"
                >
                  Ver como funciona
                </a>
              </div>

              {/* Social proof */}
              <div className="mt-10 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {["J", "M", "A", "L", "K"].map((letter, i) => (
                    <div
                      key={letter}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#111b21] bg-[#202c33] text-xs font-bold text-gray-300"
                      style={{ zIndex: 5 - i }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-300">150+</span> emprendimientos
                </p>
              </div>
            </div>

            {/* Hero illustration */}
            <div className="flex justify-center lg:justify-end">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="como-funciona" className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Simples 3 pasos</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">De cero a bot en 2 minutos</h2>
            <p className="mt-3 text-sm text-gray-400">No necesitas saber programar</p>
          </div>

          <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <StepQRCode />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-lg font-bold text-[#00a884]">
                  1
                </div>
                <h3 className="text-lg font-semibold">Conecta tu WhatsApp</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  Escanea un codigo QR desde tu telefono. Tu WhatsApp queda vinculado al bot.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#00a884]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  30 segundos
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <StepConfig />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-lg font-bold text-[#e6a44e]">
                  2
                </div>
                <h3 className="text-lg font-semibold">Configura respuestas</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  Escribe que palabras clave deben activar una respuesta. Usa plantillas o crea las tuyas.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#e6a44e]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  1 minuto
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <StepActive />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-lg font-bold text-[#53bdeb]">
                  3
                </div>
                <h3 className="text-lg font-semibold">Bot activo</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  Tu bot esta respondiendo mensajes automaticamente. Vos monitoreas desde el panel.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#53bdeb]">
                  <ZapIcon className="h-3.5 w-3.5" />
                  24/7
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Funcionalidades</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Todo lo que necesitas</h2>
            <p className="mt-3 text-sm text-gray-400">Herramientas pensadas para emprendedores</p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {/* Feature 1: Auto Responses */}
            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                  <ZapIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Respuestas automaticas</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Por palabra clave o expresion regular. Configura en segundos y tu bot empieza a responder solo.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureAutoResponses />
              </div>
            </div>

            {/* Feature 2: Multi-user */}
            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-[#53bdeb]">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Multi-usuario</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Administra multiples usuarios, cada uno con su propia instancia de WhatsApp independiente.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureMultiUser />
              </div>
            </div>

            {/* Feature 3: Analytics */}
            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-[#e6a44e]">
                  <MessageCircleIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Panel de control</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Estadisticas en tiempo real, logs de actividad y metricas de rendimiento de tu bot.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureAnalytics />
              </div>
            </div>

            {/* Feature 4: Security */}
            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                  <ShieldIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Seguro y privado</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Encriptacion, autenticacion JWT, rate limiting y webhook HMAC. Tus datos estan protegidos.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureSecurity />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="precios" className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Precios</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Simple y transparente</h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-lg gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-white/5 bg-[#111b21] p-8">
              <p className="text-sm font-semibold text-gray-400">Basico</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Para probar</p>
              <ul className="mt-6 space-y-3">
                {["1 instancia", "10 auto-respuestas", "100 mensajes/mes", "Soporte por email"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckIcon className="h-4 w-4 shrink-0 text-[#00a884]" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="mt-8 flex w-full items-center justify-center rounded-xl border border-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Empezar gratis
              </a>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border border-[#00a884]/30 bg-[#111b21] p-8">
              <div className="absolute -top-3 right-6 rounded-full bg-[#00a884] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Popular
              </div>
              <p className="text-sm font-semibold text-[#00a884]">Profesional</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$9.990</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Para negocios</p>
              <ul className="mt-6 space-y-3">
                {[
                  "5 instancias",
                  "Ilimitado auto-respuestas",
                  "Ilimitado mensajes",
                  "Soporte prioritario",
                  "Multi-usuario",
                  "Estadisticas avanzadas",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckIcon className="h-4 w-4 shrink-0 text-[#00a884]" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="mt-8 flex w-full items-center justify-center rounded-xl bg-[#00a884] py-3 text-sm font-semibold text-white transition hover:bg-[#00a884]/90"
              >
                Elegir Profesional
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Tu bot esta a un
            <span className="text-[#00a884]"> clic</span>
          </h2>
          <p className="mt-4 text-base text-gray-400">
            Unite a mas de 150 emprendimientos que ya automatizaron su WhatsApp
          </p>
          <a
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition hover:bg-[#00a884]/90"
          >
            Crear cuenta gratis
            <ArrowRightIcon className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00a884]/15 text-[#00a884]">
              <MessageCircleIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold">Bot WhatsApp</span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Bot WhatsApp. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-xs text-gray-500 transition hover:text-gray-300">
              Login
            </a>
            <a href="/register" className="text-xs text-gray-500 transition hover:text-gray-300">
              Registro
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
