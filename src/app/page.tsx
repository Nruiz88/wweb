import type { Metadata } from "next";
import {
  ShieldIcon,
  UsersIcon,
  ArrowRightIcon,
  PlayCircleIcon,
  QuickReplyIcon,
  AnalyticsIcon,
} from "@/components/icons";
import { LogoMark } from "@/components/logo";
import LandingNav from "@/components/LandingNav";
import { ChatAutoResponses, ChatAppointments } from "@/components/LandingChats";
import { StepQRCode, StepConfig, StepActive } from "@/components/illustrations";

export const metadata: Metadata = {
  title: "Boti - Tu asistente de WhatsApp",
  description:
    "Boti es tu asistente virtual de WhatsApp. Responde automáticamente tus clientes, 24 horas, los 7 días. Sin contratar a nadie, sin saber de código. Actívalo gratis.",
  alternates: {
    canonical: "/",
  },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-label text-sm font-bold uppercase tracking-widest text-text-secondary">
      {children}
    </h2>
  );
}

function CheckCircle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-dim text-white">
      {/* Background pattern */}
      <div className="ld-bg-pattern pointer-events-none fixed inset-0 z-[-1]" />

      {/* ===== NAVBAR ===== */}
      <LandingNav />

      <main className="pt-[100px]">
        {/* ===== HERO ===== */}
        <section className="relative mx-auto flex min-h-[921px] max-w-[1280px] flex-col items-center justify-center px-6 pb-24 pt-16 text-center md:px-0">
          {/* Abstract background shader */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
            <div className="h-full w-full bg-[radial-gradient(circle_at_center,rgba(0,168,132,0.15)_0%,transparent_50%)]" />
          </div>

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-whatsapp-green/30 bg-whatsapp-green/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#00a884]" />
              <span className="font-label text-sm font-bold uppercase tracking-wider text-[#00a884]">
                Hecho para emprendedores argentinos
              </span>
            </div>

            <h1 className="mb-6 font-bold leading-tight text-[64px] tracking-tight">
              Tu negocio <br />
              <span className="bg-gradient-to-r from-[#00a884] to-teal-dark bg-clip-text text-transparent">
                nunca duerme
              </span>
            </h1>

            <p className="mb-10 max-w-2xl text-balance text-lg leading-[1.6] text-text-secondary">
              <strong className="text-white">Boti</strong> es tu asistente virtual de WhatsApp. Responde automáticamente tus clientes, 24 horas, los 7 días. Sin contratar a nadie, sin saber de código.
            </p>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <a
                href="/register"
                className="ld-glow-accent group flex w-full items-center justify-center gap-2 rounded-full bg-[#00a884] px-8 py-4 font-label text-sm font-bold text-white transition-all hover:bg-[#008f6f] sm:w-auto"
              >
                Activar Boti gratis
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#demo"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#00a884] px-8 py-4 font-label text-sm font-bold text-[#00a884] transition-colors hover:bg-[#00a884]/10 sm:w-auto"
              >
                Ver cómo funciona
                <PlayCircleIcon className="h-4 w-4" />
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex items-center gap-4 text-xs font-medium text-text-secondary">
              <div className="flex -space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-dim bg-surface-container-high text-[10px] text-white">
                  J
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-dim bg-surface-container-highest text-[10px] text-white">
                  M
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-dim bg-teal-dark text-[10px] text-white">
                  A
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-dim bg-surface-bright text-[10px] text-white">
                  +150
                </div>
              </div>
              <span>150+ emprendimientos en Argentina ya lo usan</span>
            </div>
          </div>

          {/* Hero phone mockups */}
          <div id="demo" className="relative z-10 mx-auto mt-16 flex w-full max-w-[850px] scroll-mt-24 flex-col items-center justify-center gap-6 md:flex-row md:gap-8">
            <ChatAutoResponses />
            <ChatAppointments />
          </div>
        </section>

        {/* ===== PROBLEM ===== */}
        <section id="problema" className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Problema</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">¿Te suena esto?</h3>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              { emoji: "😴", text: "Te escriben de noche y no contestás hasta la mañana" },
              { emoji: "🤯", text: "Te preguntan lo mismo 50 veces por día: horarios, precios, direcciones" },
              { emoji: "📱", text: "Perdés clientes porque no podés estar pegado al teléfono todo el día" },
            ].map((item) => (
              <div
                key={item.text}
                className="ld-card-panel rounded-2xl p-8 text-center transition-transform duration-300 hover:-translate-y-2"
              >
                <div className="mb-6 text-5xl">{item.emoji}</div>
                <p className="text-lg text-text-secondary">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-2xl font-bold text-whatsapp-green">Boti resuelve todo eso por vos.</p>
          </div>
        </section>

        {/* ===== PROCESS ===== */}
        <section id="proceso" className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Proceso</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">De cero a bot en 2 minutos</h3>
            <p className="text-lg text-text-secondary">No necesitás saber programar. Posta.</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="ld-card-panel group flex flex-col overflow-hidden rounded-2xl transition-colors hover:border-whatsapp-green/30">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b border-white/5 bg-[#0b141a]">
                <div className="transition-transform duration-500 group-hover:scale-105">
                  <StepQRCode />
                </div>
              </div>
              <div className="relative flex flex-grow flex-col p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-whatsapp-green/10 text-xl font-bold text-whatsapp-green">
                  1
                </div>
                <h4 className="mb-4 text-2xl font-bold">Escaneá el QR</h4>
                <p className="mb-6 text-text-secondary">
                  Abrí WhatsApp en tu celular, escaneá el código y listo. Boti ya está conectado.
                </p>
                <div className="mt-auto font-label text-sm font-bold uppercase tracking-wider text-whatsapp-green">
                  30 segundos
                </div>
              </div>
            </div>

            <div className="ld-card-panel group flex flex-col overflow-hidden rounded-2xl transition-colors hover:border-whatsapp-green/30">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b border-white/5 bg-[#0b141a]">
                <div className="transition-transform duration-500 group-hover:scale-105">
                  <StepConfig />
                </div>
              </div>
              <div className="relative flex flex-grow flex-col p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-whatsapp-green/10 text-xl font-bold text-whatsapp-green">
                  2
                </div>
                <h4 className="mb-4 text-2xl font-bold">Escribí las respuestas</h4>
                <p className="mb-6 text-text-secondary">
                  &quot;Cuando te escriban precio, contestá esto...&quot; Así de simple. O usá las plantillas que te dejamos.
                </p>
                <div className="mt-auto font-label text-sm font-bold uppercase tracking-wider text-whatsapp-green">
                  1 minuto
                </div>
              </div>
            </div>

            <div className="ld-card-panel group flex flex-col overflow-hidden rounded-2xl transition-colors hover:border-whatsapp-green/30">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden border-b border-white/5 bg-[#0b141a]">
                <div className="transition-transform duration-500 group-hover:scale-105">
                  <StepActive />
                </div>
              </div>
              <div className="relative flex flex-grow flex-col p-8">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-whatsapp-green/10 text-xl font-bold text-whatsapp-green">
                  3
                </div>
                <h4 className="mb-4 text-2xl font-bold">Boti responde solo</h4>
                <p className="mb-6 text-text-secondary">
                  Tu bot está activo 24/7. Vos seguís con tu negocio y Boti atiende los mensajes.
                </p>
                <div className="mt-auto font-label text-sm font-bold uppercase tracking-wider text-whatsapp-green">
                  Siempre activo
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section id="funcionalidades" className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Funcionalidades</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">Todo lo que tu negocio necesita</h3>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {[
              {
                icon: <QuickReplyIcon className="h-9 w-9" />,
                title: "Respuestas automáticas",
                desc: "Cuando alguien escribe \"horario\", \"precio\" o \"dirección\", Boti contesta solo. Automático, sin que hagas nada.",
              },
              {
                icon: <UsersIcon className="h-9 w-9" />,
                title: "Para tu equipo",
                desc: "Si sos admin, podés crear cuentas para cada empleado. Cada uno tiene su propio Boti.",
              },
              {
                icon: <AnalyticsIcon className="h-9 w-9" />,
                title: "Sabés quién te escribe",
                desc: "Ves en tiempo real cuántos mensajes contestó Boti, cuáles funcionaron y cuáles no.",
              },
              {
                icon: <ShieldIcon className="h-9 w-9" />,
                title: "Seguro y confiable",
                desc: "Tus datos y los de tus clientes están protegidos. Cada cuenta es independiente y segura.",
              },
            ].map((feature) => (
              <div key={feature.title} className="ld-card-panel rounded-2xl p-8 transition-colors hover:bg-surface-elevated">
                <div className="mb-4 text-whatsapp-green">{feature.icon}</div>
                <h4 className="mb-4 text-2xl font-bold">{feature.title}</h4>
                <p className="text-text-secondary">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section id="precios" className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Precios</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">Simple, como todo debería ser</h3>
            <p className="text-lg text-text-secondary">
              Todos los planes incluyen <strong className="text-white">1 bot / número de WhatsApp</strong> por defecto
            </p>
          </div>

          <div className="grid items-stretch gap-8 lg:grid-cols-3">
            {/* Starter */}
            <div className="ld-card-panel flex flex-col rounded-3xl border border-white/10 p-8 transition-colors hover:border-white/20">
              <h4 className="mb-2 text-2xl font-bold">Starter</h4>
              <p className="mb-6 text-text-secondary">Atención Básica</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$12.000</span>
                <span className="text-text-secondary"> ARS/mes</span>
              </div>
              <ul className="mb-8 flex-grow space-y-4 text-sm text-text-secondary">
                {[
                  "Respuestas automáticas por palabras clave (Keywords)",
                  "Menú de botones interactivos (hasta 3 opciones y submenús)",
                  "Mensaje de bienvenida y respuesta fuera de horario comercial",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-whatsapp-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <p className="mb-6 text-xs italic text-text-secondary opacity-80">
                  Ideal para: Showrooms, comercios minoristas, locales gastronómicos, repartidores
                </p>
                <a
                  href="/register"
                  className="block w-full rounded-full border border-whatsapp-green py-3 px-4 text-center font-label text-sm font-bold text-whatsapp-green transition-colors hover:bg-whatsapp-green/10"
                >
                  Empezar con Starter
                </a>
              </div>
            </div>

            {/* Pro */}
            <div className="ld-card-panel relative flex flex-col rounded-3xl border-2 border-whatsapp-green bg-surface-elevated p-8 shadow-[0_0_30px_rgba(37,211,102,0.15)] transition-transform lg:-translate-y-4">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-whatsapp-green px-4 py-1 font-label text-sm font-bold tracking-wide text-surface-dim">
                Recomendado
              </div>
              <h4 className="mb-2 text-2xl font-bold">Pro</h4>
              <p className="mb-6 text-text-secondary">Gestión Avanzada</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$22.000</span>
                <span className="text-text-secondary"> ARS/mes</span>
              </div>
              <ul className="mb-8 flex-grow space-y-4 text-sm text-text-secondary">
                {[
                  "Todas las funciones del plan Starter",
                  "Módulo de calendario y agenda con asignación de turnos",
                  "Confirmación de citas en tiempo real en la base de datos (Supabase)",
                  "Recordatorio automático 24 hs antes por WhatsApp con botones (Confirmar / Cancelar)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-whatsapp-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <p className="mb-6 text-xs italic text-text-secondary opacity-80">
                  Ideal para: Barberías, centros de estética, consultorios médicos/odontológicos, canchas de pádel o fútbol, entrenadores personales
                </p>
                <a
                  href="/register"
                  className="block w-full rounded-full bg-whatsapp-green py-3 px-4 text-center font-label text-sm font-bold text-surface-dim transition-colors hover:bg-[#00a884]"
                >
                  Elegir Pro
                </a>
              </div>
            </div>

            {/* Community */}
            <div className="ld-card-panel flex flex-col rounded-3xl border border-white/10 p-8 transition-colors hover:border-white/20">
              <h4 className="mb-2 text-2xl font-bold">Community</h4>
              <p className="mb-6 text-text-secondary">Grupos &amp; Difusión</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">$35.000</span>
                <span className="text-text-secondary"> ARS/mes</span>
              </div>
              <ul className="mb-8 flex-grow space-y-4 text-sm text-text-secondary">
                {[
                  "Todas las funciones del plan Starter",
                  "Bienvenida automática en grupos etiquetando al usuario (@usuario)",
                  "Moderación y filtro anti-spam (eliminación de links no autorizados)",
                  "Programador de comunicados / notificaciones masivas a varios grupos",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-whatsapp-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <p className="mb-6 text-xs italic text-text-secondary opacity-80">
                  Ideal para: Profesores, academias, gimnasios, clubes, administradores de comunidades o señales
                </p>
                <a
                  href="/register"
                  className="block w-full rounded-full border border-whatsapp-green py-3 px-4 text-center font-label text-sm font-bold text-whatsapp-green transition-colors hover:bg-whatsapp-green/10"
                >
                  Elegir Community
                </a>
              </div>
            </div>
          </div>

          {/* Add-on */}
          <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-8 rounded-3xl border-2 border-teal-dark/30 bg-surface-bright p-8 text-center shadow-[0_0_30px_rgba(0,168,132,0.15)] transition-all duration-300 hover:border-teal-dark sm:flex-row sm:text-left">
            <div className="absolute" />
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-dark/20 text-teal-dark shadow-inner">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
            </div>
            <div className="flex-grow">
              <h4 className="mb-2 text-2xl font-bold">Bot / Instancia extra (Add-on)</h4>
              <p className="text-base text-text-secondary">
                Conectá un número adicional cuando necesites separar canales (ej. Ventas y Soporte, o distintas sucursales)
              </p>
            </div>
            <div className="flex flex-col items-center whitespace-nowrap font-bold text-teal-dark sm:ml-auto sm:items-end">
              <span className="text-3xl">+$6.000</span>
              <span className="font-label text-sm uppercase tracking-tighter text-text-secondary">ARS/mes</span>
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section id="cta" className="mx-auto max-w-[1280px] px-6 py-24 text-center">
          <div className="relative overflow-hidden rounded-3xl border border-whatsapp-green/20 bg-gradient-to-b from-[#1a252a] to-[#0a151a] p-12 shadow-2xl md:p-20">
            <div className="pointer-events-none absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(37,211,102,0.25)_0%,transparent_70%)]" />
            <div className="relative z-10">
              <h2 className="mb-6 text-4xl font-bold md:text-5xl">Dejá de perder clientes</h2>
              <p className="mx-auto mb-10 max-w-2xl text-xl text-text-secondary">
                Activá Boti en 2 minutos y empezá a contestar solo
              </p>
              <a
                href="/register"
                className="ld-glow-accent group inline-flex items-center justify-center gap-3 rounded-full bg-whatsapp-green px-10 py-4 font-label text-lg font-bold text-surface-dim transition-all hover:bg-[#00a884]"
              >
                Crear cuenta gratis
                <ArrowRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
              <p className="mt-6 text-sm text-text-secondary">Sin tarjeta de crédito. Sin compromiso.</p>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mx-auto mt-12 flex max-w-[1280px] w-full flex-col items-center justify-between border-t border-white/5 px-6 py-24 md:flex-row">
        <div className="mb-6 flex flex-col items-center md:mb-0 md:items-start">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#00a884]">
            <LogoMark />
            Boti
          </div>
          <p className="text-text-secondary">
            &copy; {new Date().getFullYear()} Boti. Hecho con verde en Argentina 🇦🇷
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-6">
          <a href="#funcionalidades" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Funcionalidades
          </a>
          <a href="#precios" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Precios
          </a>
          <a href="/login" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Login
          </a>
          <a href="/register" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Registro
          </a>
        </nav>
      </footer>
    </div>
  );
}