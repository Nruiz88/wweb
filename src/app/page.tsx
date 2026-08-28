import type { Metadata } from "next";
import {
  ZapIcon,
  ShieldIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
  ArrowRightIcon,
  MessageCircleIcon,
  PlusIcon,
} from "@/components/icons";
import { Logo } from "@/components/logo";
import LandingNav from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "Boti - Tu asistente de WhatsApp",
  description:
    "Boti es tu asistente virtual de WhatsApp. Responde automaticamente tus clientes, 24 horas, los 7 dias. Sin contratar a nadie, sin saber de codigo. Activalo gratis.",
  alternates: {
    canonical: "/",
  },
};
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
      <LandingNav />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00a884]/5 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[#00a884]/8 blur-[120px]" />
        <div className="absolute -right-20 top-20 h-40 w-40 rounded-full border border-[#00a884]/10" />
        <div className="absolute -left-10 bottom-20 h-24 w-24 rounded-full border border-[#00a884]/5" />
        <div className="absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-[#00a884]/30" />
        <div className="absolute left-1/4 top-2/3 h-1.5 w-1.5 rounded-full bg-[#00a884]/20" />

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Text */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#00a884]/20 bg-[#00a884]/10 px-4 py-1.5 text-xs font-medium text-[#00a884] backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00a884] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00a884]" />
                </span>
                Hecho para emprendedores argentinos
              </div>

              <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Tu negocio
                <br />
                <span className="bg-gradient-to-r from-[#00a884] to-[#25d366] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,168,132,0.3)]">
                  nunca duerme
                </span>
              </h1>

              <p className="mt-6 max-w-lg text-base text-gray-400 sm:text-lg">
                <strong className="text-white">Boti</strong> es tu asistente virtual de WhatsApp. Responde automaticamente tus clientes, 24 horas, los 7 dias. Sin contratar a nadie, sin saber de codigo.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/register"
                  className="group flex items-center justify-center gap-2 rounded-xl bg-[#00a884] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:bg-[#00a884]/90 hover:shadow-xl hover:shadow-[#00a884]/30 hover:scale-[1.02]"
                >
                  Activar Boti gratis
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href="#como-funciona"
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-sm font-medium text-gray-300 transition-all hover:border-white/20 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5"
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
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#111b21] bg-gradient-to-br from-[#202c33] to-[#2a3942] text-xs font-bold text-gray-300 shadow-lg"
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
      <section className="relative border-t border-white/5 bg-[#202c33]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,168,132,0.03),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="text-center">
            <span className="inline-block rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">Problema</span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Te suena esto?</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { emoji: "😴", text: "Te escriben de noche y no contestas hasta la manana", color: "#ef4444" },
              { emoji: "🤯", text: "Te preguntan lo mismo 50 veces por dia: horarios, precios, direcciones", color: "#f59e0b" },
              { emoji: "📱", text: "Perdes clientes porque no podes estar pegado al telefono todo el dia", color: "#3b82f6" },
            ].map((item) => (
              <div key={item.text} className="group relative overflow-hidden rounded-xl border border-white/5 bg-[#111b21] p-5 text-center transition-all hover:border-white/10 hover:shadow-lg hover:shadow-black/20">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-transparent transition-colors group-hover:from-white/[0.02]" />
                <span className="relative text-3xl">{item.emoji}</span>
                <p className="relative mt-3 text-sm text-gray-300">{item.text}</p>
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#00a884]/10 px-5 py-2">
              <CheckIcon className="h-4 w-4 text-[#00a884]" />
              <p className="text-sm font-semibold text-white">
                <span className="text-[#00a884]">Boti</span> resuelve todo eso por vos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="como-funciona" className="relative border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,168,132,0.03),_transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#00a884]/10 px-3 py-1 text-xs font-semibold text-[#00a884]">Proceso</span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">De cero a bot en 2 minutos</h2>
            <p className="mt-3 text-sm text-gray-400">No necesitas saber programar. Posta.</p>
          </div>

          <div className="relative mt-16">
            {/* Connection lines between steps */}
            <div className="absolute left-[20%] top-24 hidden h-px w-[60%] bg-gradient-to-r from-[#00a884]/30 via-[#e6a44e]/30 to-[#53bdeb]/30 sm:block" />

            <div className="grid gap-12 sm:grid-cols-3 sm:gap-8">
              <div className="group relative flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-2xl bg-[#00a884]/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                  <StepQRCode />
                </div>
                <div className="mt-6">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00a884]/15 text-lg font-bold text-[#00a884] ring-4 ring-[#111b21]">1</div>
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

              <div className="group relative flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-2xl bg-[#e6a44e]/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                  <StepConfig />
                </div>
                <div className="mt-6">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-lg font-bold text-[#e6a44e] ring-4 ring-[#111b21]">2</div>
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

              <div className="group relative flex flex-col items-center text-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-2xl bg-[#53bdeb]/5 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                  <StepActive />
                </div>
                <div className="mt-6">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#53bdeb]/15 text-lg font-bold text-[#53bdeb] ring-4 ring-[#111b21]">3</div>
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
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="relative border-t border-white/5 bg-[#202c33]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,168,132,0.04),_transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#00a884]/10 px-3 py-1 text-xs font-semibold text-[#00a884]">Funcionalidades</span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Todo lo que tu negocio necesita</h2>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {[
              { icon: <ZapIcon className="h-5 w-5" />, title: "Respuestas automaticas", desc: "Cuando alguien escribe \"horario\", \"precio\" o \"direccion\", Boti contesta solo. Automatico, sin que hagas nada.", color: "#00a884", illustration: <FeatureAutoResponses /> },
              { icon: <UsersIcon className="h-5 w-5" />, title: "Para tu equipo", desc: "Si sos admin, podes crear cuentas para cada empleado. Cada uno tiene su propio Boti.", color: "#53bdeb", illustration: <FeatureMultiUser /> },
              { icon: <MessageCircleIcon className="h-5 w-5" />, title: "Sabis quien te escribe", desc: "Ves en tiempo real cuantos mensajes contesto Boti, cuales funcionaron y cuales no.", color: "#e6a44e", illustration: <FeatureAnalytics /> },
              { icon: <ShieldIcon className="h-5 w-5" />, title: "Seguro y confiable", desc: "Tus datos y los de tus clientes estan protegidos. Cada cuenta es independiente y segura.", color: "#00a884", illustration: <FeatureSecurity /> },
            ].map((feature) => (
              <div key={feature.title} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#111b21] transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-black/30">
                {/* Glow effect on hover */}
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-transparent via-white/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                <div className="relative p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${feature.color}15`, color: feature.color }}>
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-400">{feature.desc}</p>
                </div>
                <div className="relative border-t border-white/5 bg-[#0b141a] p-4 transition-colors group-hover:bg-[#0d181e]">
                  {feature.illustration}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="precios" className="relative border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,168,132,0.03),_transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#00a884]/10 px-3 py-1 text-xs font-semibold text-[#00a884]">Precios</span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Simple, como todo deberia ser</h2>
            <p className="mt-3 text-sm text-gray-400">
              Todos los planes incluyen <strong className="text-white">1 bot / numero de WhatsApp</strong> por defecto
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-3">
            {/* Starter */}
            <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] p-6 transition-all duration-300 hover:border-[#53bdeb]/30 hover:shadow-xl hover:shadow-black/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#53bdeb]">Starter</p>
                <span className="rounded-full bg-[#53bdeb]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#53bdeb]">
                  Atencion Basica
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$12.000</span>
                <span className="text-sm text-gray-500">ARS/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">1 bot / numero de WhatsApp</p>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "Respuestas automaticas por palabras clave (Keywords)",
                  "Menu de botones interactivos (hasta 3 opciones y submenus)",
                  "Mensaje de bienvenida y respuesta fuera de horario comercial",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#53bdeb]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-gray-500">
                <span className="font-semibold text-gray-400">Ideal para:</span> Showrooms, comercios minoristas, locales gastronomicos, repartidores
              </p>
              <a
                href="/register"
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/10 py-3 text-sm font-semibold text-white transition-all hover:border-[#53bdeb]/30 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5"
              >
                Empezar con Starter
              </a>
            </div>

            {/* Pro */}
            <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#00a884]/30 bg-[#202c33] p-6 transition-all duration-300 hover:border-[#00a884]/50 hover:shadow-xl hover:shadow-[#00a884]/10">
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#00a884]/10 via-transparent to-transparent opacity-50" />
              <div className="relative flex items-center justify-between">
                <p className="text-sm font-semibold text-[#00a884]">Pro</p>
                <span className="rounded-full bg-gradient-to-r from-[#00a884] to-[#25d366] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg shadow-[#00a884]/30">
                  Recomendado
                </span>
              </div>
              <div className="relative mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$22.000</span>
                <span className="text-sm text-gray-500">ARS/mes</span>
              </div>
              <p className="relative mt-2 text-xs text-gray-500">1 bot / numero de WhatsApp</p>
              <ul className="relative mt-6 flex-1 space-y-3">
                {[
                  "Todas las funciones del plan Starter",
                  "Modulo de calendario y agenda con asignacion de turnos",
                  "Confirmacion de citas en tiempo real en la base de datos (Supabase)",
                  "Recordatorio automatico 24 hs antes por WhatsApp con botones (Confirmar / Cancelar)",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#00a884]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="relative mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-gray-500">
                <span className="font-semibold text-gray-400">Ideal para:</span> Barberias, centros de estetica, consultorios medicos/odontologicos, canchas de padel o futbol, entrenadores personales
              </p>
              <a
                href="/register"
                className="relative mt-5 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:shadow-xl hover:shadow-[#00a884]/35 hover:scale-[1.02]"
              >
                Elegir Pro
              </a>
            </div>

            {/* Community */}
            <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#202c33] p-6 transition-all duration-300 hover:border-[#e6a44e]/30 hover:shadow-xl hover:shadow-black/20">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#e6a44e]">Community</p>
                <span className="rounded-full bg-[#e6a44e]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#e6a44e]">
                  Grupos &amp; Difusion
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">$35.000</span>
                <span className="text-sm text-gray-500">ARS/mes</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">1 bot / numero de WhatsApp</p>
              <ul className="mt-6 flex-1 space-y-3">
                {[
                  "Todas las funciones del plan Starter",
                  "Bienvenida automatica en grupos etiquetando al usuario (@usuario)",
                  "Moderacion y filtro anti-spam (eliminacion de links no autorizados)",
                  "Programador de comunicados / notificaciones masivas a varios grupos",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#e6a44e]" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2 text-[10px] leading-relaxed text-gray-500">
                <span className="font-semibold text-gray-400">Ideal para:</span> Profesores, academias, gimnasios, clubes, administradores de comunidades o senales
              </p>
              <a
                href="/register"
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/10 py-3 text-sm font-semibold text-white transition-all hover:border-[#e6a44e]/30 hover:bg-white/5 hover:shadow-lg hover:shadow-white/5"
              >
                Elegir Community
              </a>
            </div>
          </div>

          {/* Add-on */}
          <div className="mx-auto mt-6 max-w-4xl">
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-[#e6a44e]/30 bg-[#202c33]/50 p-6 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-[#e6a44e]">
                  <PlusIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Bot / Servidor extra (Add-on)</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Conecta un numero adicional cuando necesites separar canales (ej. Ventas y Soporte, o distintas sucursales)
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-baseline gap-1">
                <span className="text-2xl font-bold text-[#e6a44e]">+$6.000</span>
                <span className="text-sm text-gray-500">ARS/mes por bot</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative border-t border-white/5 bg-[#202c33] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,168,132,0.06),_transparent_60%)]" />
        <div className="absolute -left-20 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full border border-[#00a884]/10" />
        <div className="absolute -right-20 top-1/2 h-60 w-60 -translate-y-1/2 rounded-full border border-[#00a884]/5" />
        
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28 text-center">
          <Logo size="lg" className="mx-auto mb-6 justify-center" />
          <h2 className="text-3xl font-bold sm:text-4xl">
            Deja de perder clientes
          </h2>
          <p className="mt-4 text-base text-gray-400">
            Activá Boti en 2 minutos y empeza a contestar solo
          </p>
          <a
            href="/register"
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] px-10 py-4 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/25 transition-all hover:shadow-xl hover:shadow-[#00a884]/40 hover:scale-[1.02]"
          >
            Crear cuenta gratis
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
