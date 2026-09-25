"use client";

import { LogoMark } from "./logo";
import {
  ChatAutoResponses,
  ChatAppointments,
  ChatKeywords,
  ChatMenuDemo,
  ChatReminderDemo,
} from "./LandingChats";
import { StepQRCode, StepConfig, StepActive } from "./illustrations";
import { getLandingFaqs } from "@/lib/faq";
import type { PublicPlan } from "@/lib/plans";

// ─── Precios por defecto (solo si el server no pudo leer la DB) ─────────
const DEFAULT_PLANS: PublicPlan[] = [
  {
    plan_type: "starter",
    label: "Starter",
    description: "Para pymes pequeñas",
    amount_pesos: 18000,
    max_instances: 1,
  },
  {
    plan_type: "pro",
    label: "Pro",
    description: "Para negocios en crecimiento",
    amount_pesos: 25000,
    max_instances: 3,
  },
];

const DEFAULT_ADDON_PRICE = 7000;

function formatArs(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

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

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function BotPlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
    </svg>
  );
}

// ─── Features con mockup visual ──────────────────────────────────────────
function FeatureWithChat({
  title,
  desc,
  bullets,
  badge,
  chat,
  flip = false,
}: {
  title: string;
  desc: string;
  bullets: string[];
  badge: string;
  chat: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <span className="mb-4 inline-block rounded-full border border-whatsapp-green/30 bg-whatsapp-green/10 px-3 py-1 font-label text-xs font-bold uppercase tracking-wider text-whatsapp-green">
          {badge}
        </span>
        <h4 className="mb-4 text-3xl font-bold">{title}</h4>
        <p className="mb-6 text-lg leading-relaxed text-text-secondary">{desc}</p>
        <ul className="space-y-3 text-sm text-text-secondary">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-whatsapp-green" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{chat}</div>
    </div>
  );
}

export default function Landing({
  plans,
  addonPrice,
}: {
  plans: PublicPlan[];
  addonPrice: number;
}) {
  const safePlans =
    plans && plans.length > 0 ? plans : DEFAULT_PLANS;
  const safeAddonPrice = typeof addonPrice === "number" && addonPrice > 0 ? addonPrice : DEFAULT_ADDON_PRICE;

  const starter = safePlans.find((p) => p.plan_type === "starter") ?? DEFAULT_PLANS[0];
  const pro = safePlans.find((p) => p.plan_type === "pro") ?? DEFAULT_PLANS[1];

  return (
    <div className="min-h-screen bg-surface-dim text-white">
      {/* Background pattern */}
      <div className="ld-bg-pattern pointer-events-none fixed inset-0 z-[-1]" />

      {/* ===== NAVBAR ===== */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-surface-dim/80 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2 font-bold text-[#00a884]">
            <LogoMark />
            Boti
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#funcionalidades" className="font-label text-sm font-medium text-text-secondary transition-colors hover:text-white">
              Funciones
            </a>
            <a href="#proceso" className="font-label text-sm font-medium text-text-secondary transition-colors hover:text-white">
              Cómo funciona
            </a>
            <a href="#precios" className="font-label text-sm font-medium text-text-secondary transition-colors hover:text-white">
              Precios
            </a>
            <a href="/login" className="font-label text-sm font-medium text-text-secondary transition-colors hover:text-white">
              Ingresar
            </a>
          </div>
          <a
            href="/register"
            className="rounded-full bg-[#00a884] px-5 py-2 font-label text-sm font-bold text-white transition-colors hover:bg-[#008f6f]"
          >
            Crear cuenta
          </a>
        </div>
      </nav>

      <main className="pt-[72px]">
        {/* ===== HERO ===== */}
        <section className="relative mx-auto flex max-w-[1280px] flex-col items-center justify-center px-6 pb-24 pt-16 text-center md:px-0">
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

            <h1 className="mb-6 font-bold leading-tight text-[48px] tracking-tight md:text-[64px]">
              Tu negocio <br />
              <span className="bg-gradient-to-r from-[#00a884] to-teal-dark bg-clip-text text-transparent">
                nunca duerme
              </span>
            </h1>

            <p className="mb-10 max-w-2xl text-balance text-lg leading-[1.6] text-text-secondary">
              <strong className="text-white">Boti</strong> es tu asistente virtual de WhatsApp. Responde solo,{" "}
              <strong className="text-white">agenda turnos</strong> y{" "}
              <strong className="text-white">toma pedidos</strong>, 24 horas, los 7 días. Sin contratar a nadie, sin saber de código.
            </p>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              <a
                href="/register"
                className="ld-glow-accent group flex w-full items-center justify-center gap-2 rounded-full bg-[#00a884] px-8 py-4 font-label text-sm font-bold text-white transition-all hover:bg-[#008f6f] sm:w-auto"
              >
                Activar Boti gratis
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
              <a
                href="#demo"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-[#00a884] px-8 py-4 font-label text-sm font-bold text-[#00a884] transition-colors hover:bg-[#00a884]/10 sm:w-auto"
              >
                Ver cómo funciona
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="m10 8 6 4-6 4V8Z" />
                </svg>
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

        {/* ===== FEATURES (visuales) ===== */}
        <section id="funcionalidades" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 py-24">
          <div className="mb-20 text-center">
            <SectionLabel>Funcionalidades</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">Todo lo que Boti hace por vos</h3>
            <p className="text-lg text-text-secondary">Mira cómo se ve en un chat real de WhatsApp.</p>
          </div>

          <div className="space-y-24">
            <FeatureWithChat
              badge="Respuestas automáticas"
              title="Contestá antes de leer el mensaje"
              desc="Cargás las preguntas que te repiten todo el día y Boti responde solo, al instante, con el tono de tu negocio. De noche, feriados y fin de semana incluidos."
              bullets={[
                "Palabras clave ilimitadas con respuestas personalizadas",
                "Detección aunque escriban con errores o mayúsculas",
                "Mensaje de bienvenida y de fuera de horario",
              ]}
              chat={<ChatKeywords />}
            />

            <FeatureWithChat
              badge="Menús interactivos"
              title="Un menú con botones, como un cajero automático"
              desc="Armá un menú numerado o con botones para que el cliente elija: productos, sucursales, horarios. Boti lo guía solo hasta lo que necesita."
              bullets={[
                "Menús con opciones y submenús",
                "Ideal para catálogos y derivar a un humano",
              ]}
              chat={<ChatMenuDemo />}
              flip
            />

            <FeatureWithChat
              badge="Agenda de turnos"
              title="Agenda completa con confirmación por WhatsApp"
              desc="Gestioná tu calendario desde el panel y dejá que Boti agende, confirme y recuerde cada turno. Cada cita queda guardada en tu base de datos en tiempo real."
              bullets={[
                "Calendario de turnos con horarios de atención",
                "Página pública para que tus clientes agenden solos con un link",
                "Confirmaciones en tiempo real y panel de citas",
              ]}
              chat={<ChatAppointments />}
            />

            <FeatureWithChat
              badge="Recordatorios automáticos"
              title="Adiós a los ausentes: recuerda cada turno"
              desc="24 horas antes de cada cita, Boti manda el recordatorio con botones para confirmar o cancelar. Si cancelan, el turno se libera solo en tu agenda."
              bullets={[
                "Recordatorio automático 24 h antes",
                "Botones Confirmar / Cancelar dentro del chat",
                "Menos ausencias, más turnos aprovechados",
              ]}
              chat={<ChatReminderDemo />}
              flip
            />
          </div>
        </section>

        {/* ===== PROCESS ===== */}
        <section id="proceso" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 py-24">
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

        {/* ===== PRICING ===== */}
        <section id="precios" className="mx-auto max-w-[1280px] scroll-mt-20 px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Precios</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">Simple, como todo debería ser</h3>
            <p className="text-lg text-text-secondary">
              Elegí tu plan y sumá bots extra cuando tu negocio crezca. Pagás por mes, en pesos.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl items-stretch gap-8 lg:grid-cols-2">
            {/* Starter — dinámico desde plan_config */}
            <div className="ld-card-panel flex flex-col rounded-3xl border border-white/10 p-8 transition-all hover:-translate-y-1 hover:border-white/20">
              <h4 className="mb-2 text-2xl font-bold">{starter.label}</h4>
              <p className="mb-6 text-text-secondary">{starter.description || "Atención automática básica"}</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">{formatArs(starter.amount_pesos)}</span>
                <span className="text-text-secondary"> ARS/mes</span>
              </div>
              <ul className="mb-8 flex-grow space-y-4 text-sm text-text-secondary">
                {[
                  "Respuestas automáticas por palabras clave (keywords)",
                  "Menú interactivo con opciones y submenús",
                  "Mensaje de bienvenida y de fuera de horario",
                  "Registro de actividad: qué respondió tu bot",
                  `${starter.max_instances} bot conectado`,
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-whatsapp-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <p className="mb-6 text-xs italic text-text-secondary opacity-80">
                  Ideal para: comercios, showrooms, gastronomía y delivery
                </p>
                <a
                  href="/register"
                  className="block w-full rounded-full border border-whatsapp-green px-4 py-3 text-center font-label text-sm font-bold text-whatsapp-green transition-colors hover:bg-whatsapp-green/10"
                >
                  Empezar con {starter.label}
                </a>
              </div>
            </div>

            {/* Pro — dinámico desde plan_config */}
            <div className="ld-card-panel relative flex flex-col rounded-3xl border-2 border-whatsapp-green bg-surface-elevated p-8 shadow-[0_0_30px_rgba(37,211,102,0.15)] transition-transform hover:shadow-[0_0_40px_rgba(37,211,102,0.22)] lg:-translate-y-2">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-whatsapp-green px-4 py-1 font-label text-sm font-bold tracking-wide text-surface-dim">
                Recomendado
              </div>
              <h4 className="mb-2 text-2xl font-bold">{pro.label}</h4>
              <p className="mb-6 text-text-secondary">{pro.description || "Gestión avanzada"}</p>
              <div className="mb-8">
                <span className="text-4xl font-bold">{formatArs(pro.amount_pesos)}</span>
                <span className="text-text-secondary"> ARS/mes</span>
              </div>
              <ul className="mb-8 flex-grow space-y-4 text-sm text-text-secondary">
                {[
                  "Todas las funciones del plan Starter",
                  "Calendario de turnos con horarios de atención",
                  "Link público para que agenden solos: /agendar?business=tu-negocio",
                  "Recordatorio automático 24 h antes con botones Confirmar / Cancelar",
                  "Catálogo de productos y pedidos que llegan por WhatsApp",
                  `${pro.max_instances} bots incluidos`,
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-whatsapp-green" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <p className="mb-6 text-xs italic text-text-secondary opacity-80">
                  Ideal para: barberías, estética, consultorios, canchas y entrenadores
                </p>
                <a
                  href="/register"
                  className="block w-full rounded-full bg-whatsapp-green px-4 py-3 text-center font-label text-sm font-bold text-surface-dim transition-colors hover:bg-[#00a884]"
                >
                  Elegir {pro.label}
                </a>
              </div>
            </div>
          </div>

          {/* Add-on — precio dinámico */}
          <div className="mx-auto mt-16 flex max-w-3xl flex-col items-center gap-8 rounded-3xl border-2 border-teal-dark/30 bg-surface-bright p-8 text-center shadow-[0_0_30px_rgba(0,168,132,0.15)] transition-all duration-300 hover:border-teal-dark sm:flex-row sm:text-left">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-dark/20 text-teal-dark shadow-inner">
              <BotPlusIcon className="h-10 w-10" />
            </div>
            <div className="flex-grow">
              <h4 className="mb-2 text-2xl font-bold">Bot / número extra (add-on)</h4>
              <p className="text-base text-text-secondary">
                Sumá un número adicional para separar canales: ventas y soporte, o distintas sucursales. Disponible en cualquier plan.
              </p>
            </div>
            <div className="flex flex-col items-center whitespace-nowrap font-bold text-teal-dark sm:ml-auto sm:items-end">
              <span className="text-3xl">+{formatArs(safeAddonPrice)}</span>
              <span className="font-label text-sm uppercase tracking-tighter text-text-secondary">ARS/mes</span>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-text-secondary">
            Los precios están en pesos argentinos y se facturan por mes a través de Mercado Pago. Podés cancelar cuando quieras.
          </p>
        </section>

        {/* ===== FAQ (gating real) ===== */}
        <section id="faq" className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mb-16 text-center">
            <SectionLabel>Preguntas frecuentes</SectionLabel>
            <h3 className="mb-6 text-4xl font-bold md:text-5xl">Lo que todos preguntan</h3>
          </div>

          <div className="mx-auto max-w-3xl space-y-6">
            {getLandingFaqs(safePlans, safeAddonPrice).map((item) => (
              <div key={item.question} className="ld-card-panel rounded-2xl p-6">
                <h4 className="mb-3 text-lg font-bold">{item.question}</h4>
                <p className="text-text-secondary">{item.answer}</p>
              </div>
            ))}
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
                <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
              <p className="mt-6 text-sm text-text-secondary">Sin tarjeta de crédito. Sin compromiso.</p>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="mx-auto mt-12 flex w-full max-w-[1280px] flex-col items-center justify-between border-t border-white/5 px-6 py-16 md:flex-row">
        <div className="mb-6 flex flex-col items-center md:mb-0 md:items-start">
          <div className="mb-2 flex items-center gap-2 font-bold text-[#00a884]">
            <LogoMark />
            Boti
          </div>
          <p className="text-text-secondary">
            &copy; {new Date().getFullYear()} Boti. Hecho con verde en Argentina 🇦🇷
          </p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-6">
          <a href="#funcionalidades" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Funciones
          </a>
          <a href="#precios" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Precios
          </a>
          <a href="/terminos" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Términos
          </a>
          <a href="/privacidad" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Privacidad
          </a>
          <a href="/login" className="font-label text-xs font-bold uppercase text-text-secondary opacity-80 transition-colors hover:text-white hover:opacity-100">
            Ingresar
          </a>
        </nav>
      </footer>
    </div>
  );
}
