import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Términos de servicio | Boti",
  description: "Términos de servicio de Boti, tu asistente de WhatsApp.",
};

const UPDATED = "25 de septiembre de 2026";

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#0a151a] text-white">
      <div className="ld-bg-pattern pointer-events-none fixed inset-0 z-[-1]" />
      <header className="relative z-[1] border-b border-white/5 bg-[#0a151a]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-[#25d366]">
            <LogoMark />
            Boti
          </Link>
          <Link href="/" className="text-sm text-[#a8b8c2] transition-colors hover:text-white">
            ← Volver
          </Link>
        </div>
      </header>
      <main className="relative z-[1] mx-auto max-w-3xl px-6 py-14">
        <h1 className="mb-2 text-4xl font-bold">Términos de servicio</h1>
        <p className="mb-10 text-sm text-[#a8b8c2]">Última actualización: {UPDATED}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-[#c4d2dc]">
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">1. Qué es Boti</h2>
            <p>
              Boti es un asistente virtual que se conecta a tu número de WhatsApp para responder mensajes
              automáticamente, mostrar menús interactivos, gestionar catálogos y pedidos, y agendar turnos según la
              configuración que vos definas y el plan contratado.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">2. Cuenta y número de WhatsApp</h2>
            <p>
              Sos responsable de mantener la seguridad de tu cuenta y del uso que se le dé a tu número de WhatsApp
              conectado, así como del contenido de las respuestas que configures. Podés desconectar tu número en
              cualquier momento desde tu panel. El uso de WhatsApp está sujeto además a sus propios términos y
              políticas.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">3. Planes, precios y pagos</h2>
            <p>
              Los planes (Starter y Pro) se facturan por mes en pesos argentinos a través de Mercado Pago. Los precios
              vigentes están siempre publicados en la página principal. Los planes incluyen una cantidad de bots
              conectados según lo indicado en cada uno, y podés sumar bots adicionales (add-on) pagando el precio
              mensual publicado. Podés cancelar cuando quieras: el servicio sigue activo hasta el fin del período ya
              pago, sin renovaciones automáticas forzadas ni penalidades.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">4. Uso aceptable</h2>
            <p>
              No podés usar Boti para spam, estafas, acoso, envío masivo de mensajes no solicitados ni ninguna
              actividad ilegal. El incumplimiento puede derivar en la suspensión del servicio. Sos responsable de
              contar con los consentimientos necesarios de las personas con las que te comunicás a través de la
              plataforma.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">5. Datos de tus clientes</h2>
            <p>
              Los mensajes, turnos y pedidos que atraviesan Boti pertenecen a tu negocio. Vos sos responsable del
              tratamiento de los datos personales de tus clientes y de cumplir la normativa aplicable al
              comunicarte con ellos. Boti solo procesa esa información para prestarte el servicio, conforme a
              nuestra Política de Privacidad.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">6. Disponibilidad</h2>
            <p>
              Trabajamos para mantener el servicio disponible 24/7, pero depende de terceros (WhatsApp/Meta,
              proveedores de infraestructura y de pagos). No garantizamos disponibilidad ininterrumpida ni nos
              responsabilizamos por interrupciones ajenas a nuestro control. Si tu número es bloqueado por WhatsApp,
              el servicio no puede restablecerse hasta que lo reconectes.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">7. Suspensión y cancelación</h2>
            <p>
              Podés cancelar tu suscripción desde tu panel en cualquier momento. Podemos suspender cuentas ante
              falta de pago o uso que viole estos términos, avisándote cuando sea posible.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">8. Cambios</h2>
            <p>
              Podemos actualizar estos términos. Los cambios importantes se comunicarán por email o dentro de la
              plataforma, y la fecha de la última actualización siempre figura arriba.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">9. Contacto</h2>
            <p>
              Por dudas sobre estos términos, escribinos desde tu panel o a través de nuestros canales de soporte.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
