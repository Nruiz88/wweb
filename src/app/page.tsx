import {
  ZapIcon,
  ShieldIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
  ArrowRightIcon,
  MessageCircleIcon,
} from "@/components/icons";
import { Logo, LogoMark, LogoFull } from "@/components/logo";
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
          <LogoFull />
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
                Hecho para emprendedores argentinos
              </div>

              <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Tu negocio
                <br />
                <span className="bg-gradient-to-r from-[#00a884] to-[#25d366] bg-clip-text text-transparent">
                  nunca duerme
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base text-gray-400 sm:text-lg">
                <strong className="text-white">Boti</strong> es tu asistente virtual de WhatsApp. Responde automatically tus clientes, 24 horas, los 7 dias. Sin contratar a nadie, sin saber de codigo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition hover:bg-[#00a884]/90"
                >
                  Activar Boti gratis
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
                  <span className="font-semibold text-gray-300">150+</span> emprendimientos en Argentina
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

      {/* ===== PAIN POINTS ===== */}
      <section className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Te suena esto?</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { emoji: "😴", text: "Te escriben de noche y no contestas hasta la manana" },
              { emoji: "🤯", text: "Te preguntan lo mismo 50 veces por dia: horarios, precios, direcciones" },
              { emoji: "📱", text: "Perdes clientes porque no podes estar pegado al telefono todo el dia" },
            ].map((item) => (
              <div key={item.text} className="rounded-xl border border-white/5 bg-[#111b21] p-5 text-center">
                <span className="text-3xl">{item.emoji}</span>
                <p className="mt-3 text-sm text-gray-300">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-lg font-semibold text-white">
              <span className="text-[#00a884]">Boti</span> resuelve todo eso por vos.
            </p>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="como-funciona" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Simples 3 pasos</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">De cero a bot en 2 minutos</h2>
            <p className="mt-3 text-sm text-gray-400">No necesitas saber programar. Posta.</p>
          </div>

          <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
            <div className="flex flex-col items-center text-center">
              <StepQRCode />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-lg font-bold text-[#00a884]">1</div>
                <h3 className="text-lg font-semibold">Escanea el QR</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  Abri WhatsApp en tu celular, escanea el codigo y listo. Boti ya esta conectado.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#00a884]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  30 segundos
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <StepConfig />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-lg font-bold text-[#e6a44e]">2</div>
                <h3 className="text-lg font-semibold">Escribi las respuestas</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  &quot;Cuando te escriban precio, contesta esto...&quot; Asi de simple. O usa las plantillas que te dejamos.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#e6a44e]">
                  <ClockIcon className="h-3.5 w-3.5" />
                  1 minuto
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <StepActive />
              <div className="mt-6">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-lg font-bold text-[#53bdeb]">3</div>
                <h3 className="text-lg font-semibold">Boti responde solo</h3>
                <p className="mt-2 max-w-xs text-sm text-gray-400">
                  Tu bot esta activo 24/7. Vos seguis con tu negocio y Boti atiende los mensajes.
                </p>
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#53bdeb]">
                  <ZapIcon className="h-3.5 w-3.5" />
                  Siempre activo
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Funcionalidades</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Todo lo que tu negocio necesita</h2>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#111b21] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                  <ZapIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Respuestas automaticas</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Cuando alguien escribe &quot;horario&quot;, &quot;precio&quot; o &quot;direccion&quot;, Boti contesta solo. Automatico, sin que hagas nada.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureAutoResponses />
              </div>
            </div>

            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#111b21] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-[#53bdeb]">
                  <UsersIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Para tu equipo</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Si sos admin, podes crear cuentas para cada empleado. Cada uno tiene su propio Boti.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureMultiUser />
              </div>
            </div>

            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#111b21] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-[#e6a44e]">
                  <MessageCircleIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Sabis quien te escribe</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Ves en tiempo real cuantos mensajes contesto Boti, cuales funcionaron y cuales no.
                </p>
              </div>
              <div className="border-t border-white/5 bg-[#111b21] p-4">
                <FeatureAnalytics />
              </div>
            </div>

            <div className="group overflow-hidden rounded-2xl border border-white/5 bg-[#111b21] transition hover:border-white/10">
              <div className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-[#00a884]">
                  <ShieldIcon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">Seguro y confiable</h3>
                <p className="mt-1.5 text-sm text-gray-400">
                  Tus datos y los de tus clientes estan protegidos. Cada cuenta es independiente y segura.
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
      <section id="precios" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00a884]">Precios</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Simple, como todo deberia ser</h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-lg gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-[#202c33] p-8">
              <p className="text-sm font-semibold text-gray-400">Para probar</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Gratis, sin tarjeta</p>
              <ul className="mt-6 space-y-3">
                {["1 numero de WhatsApp", "10 respuestas automaticas", "100 mensajes por mes", "Soporte por email"].map((item) => (
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

            <div className="relative rounded-2xl border border-[#00a884]/30 bg-[#202c33] p-8">
              <div className="absolute -top-3 right-6 rounded-full bg-[#00a884] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Recomendado
              </div>
              <p className="text-sm font-semibold text-[#00a884]">Negocio</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$9.990</span>
                <span className="text-sm text-gray-500">/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Para negocios serios</p>
              <ul className="mt-6 space-y-3">
                {[
                  "5 numeros de WhatsApp",
                  "Respuestas ilimitadas",
                  "Mensajes ilimitados",
                  "Soporte prioritario por WhatsApp",
                  "Multiples usuarios",
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
                Elegir Negocio
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="border-t border-white/5 bg-[#202c33]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
          <Logo size="lg" className="mx-auto mb-6 justify-center" />
          <h2 className="text-3xl font-bold sm:text-4xl">
            Deja de perder clientes
          </h2>
          <p className="mt-4 text-base text-gray-400">
            Activá Boti en 2 minutos y empeza a contestar solo
          </p>
          <a
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#00a884] px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition hover:bg-[#00a884]/90"
          >
            Crear cuenta gratis
            <ArrowRightIcon className="h-4 w-4" />
          </a>
          <p className="mt-4 text-xs text-gray-500">Sin tarjeta de credito. Sin compromiso.</p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 bg-[#111b21]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Boti. Hecho con verde en Argentina 🇦🇷
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
