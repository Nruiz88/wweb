import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Términos de servicio",
  description: "Términos de servicio de Boti, tu asistente de WhatsApp.",
};

const UPDATED = "10 de septiembre de 2026";

export default function TerminosPage() {
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
        <h1 className="mb-2 text-4xl font-bold">Términos de servicio</h1>
        <p className="mb-10 text-sm text-[#a8b8c2]">Última actualización: {UPDATED}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-[#c4d2dc]">
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">1. Qué es Boti</h2>
            <p>Boti es un asistente virtual que se conecta a tu número de WhatsApp para responder mensajes automáticamente, gestionar menús y agendar turnos según la configuración que vos definas y el plan contratado.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">2. Tu cuenta y tu número</h2>
            <p>Sos responsable de mantener el acceso a tu cuenta y del uso que se le dé a tu número de WhatsApp conectado. Podés desconectar tu número en cualquier momento desde tu panel.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">3. Planes y pagos</h2>
            <p>Los planes se facturan por mes en pesos argentinos a través de Mercado Pago. Podés cancelar cuando quieras: el servicio sigue activo hasta el fin del período ya pago, sin renovaciones automáticas forzadas ni penalidades.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">4. Uso aceptable</h2>
            <p>No podés usar Boti para spam, estafas, acoso ni ninguna actividad ilegal. El incumplimiento puede derivar en la suspensión del servicio. Además, el uso de WhatsApp está sujeto a sus propios términos y políticas.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">5. Disponibilidad</h2>
            <p>Trabajamos para mantener el servicio disponible 24/7, pero depende de terceros (WhatsApp, proveedores de infraestructura). No garantizamos disponibilidad ininterrumpida ni nos responsabilizamos por interrupciones ajenas a nuestro control.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">6. Cambios</h2>
            <p>Podemos actualizar estos términos. Los cambios importantes se comunicarán por email o dentro de la plataforma.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">7. Contacto</h2>
            <p>Por dudas sobre estos términos, escribinos desde tu panel o a través de nuestros canales de soporte.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
