import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Política de privacidad de Boti: cómo tratamos tus datos y los de tus clientes.",
};

const UPDATED = "10 de septiembre de 2026";

export default function PrivacidadPage() {
  return (
    <div className="landing-dark min-h-screen text-white">
      <div className="landing-grid pointer-events-none fixed inset-0" />
      <header className="relative z-[1] border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#25d366]">
            <span class="font-bold text-[#25d366]">Boti</span> Boti
          </Link>
          <Link href="/" className="text-sm text-[#a8b8c2] hover:text-white">← Volver</Link>
        </div>
      </header>
      <main className="relative z-[1] mx-auto max-w-3xl px-6 py-14">
        <h1 className="mb-2 text-4xl font-bold">Política de privacidad</h1>
        <p className="mb-10 text-sm text-[#a8b8c2]">Última actualización: {UPDATED}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-[#c4d2dc]">
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">1. Qué datos tratamos</h2>
            <p>Tu email y datos de cuenta, la configuración de tu bot (respuestas, horarios, agenda) y los mensajes necesarios para que Boti pueda responder en tu nombre. Los pagos los procesa Mercado Pago; nunca vemos ni guardamos tu tarjeta.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">2. Para qué los usamos</h2>
            <p>Únicamente para prestar el servicio: responder mensajes, gestionar turnos y mostrarte tu actividad. No vendemos ni alquilamos datos a terceros y no hacemos publicidad con tu información.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">3. Tus chats son tuyos</h2>
            <p>Boti accede a tus mensajes solo para responder según tu configuración. Cada cuenta es independiente y podés desconectar tu número cuando quieras, lo que corta el acceso de inmediato.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">4. Tus derechos</h2>
            <p>Podés pedir acceso, corrección o eliminación de tus datos personales en cualquier momento desde tu panel o escribiéndonos por nuestros canales de soporte.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">5. Seguridad</h2>
            <p>Aplicamos controles de acceso y buenas prácticas para proteger tu información. Ningún sistema es infalible: si detectamos un incidente que te afecte, te avisaremos.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">6. Cambios</h2>
            <p>Actualizaremos esta política cuando sea necesario e indicaremos la fecha de la última versión.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
