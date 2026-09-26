import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/logo";

export const metadata: Metadata = {
  title: "Política de privacidad | Boti",
  description: "Política de privacidad de Boti: cómo tratamos tus datos y los de tus clientes.",
};

const UPDATED = "25 de septiembre de 2026";

export default function PrivacidadPage() {
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
        <h1 className="mb-2 text-4xl font-bold">Política de privacidad</h1>
        <p className="mb-10 text-sm text-[#a8b8c2]">Última actualización: {UPDATED}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-[#c4d2dc]">
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">1. Qué datos tratamos</h2>
            <p>
              Tu email y datos de cuenta, la configuración de tu bot (respuestas, horarios, menús, catálogo y
              agenda), los turnos y pedidos que se generan, y los mensajes necesarios para que Boti pueda responder
              en tu nombre. Los pagos los procesa Mercado Pago; nunca vemos ni almacenamos los datos de tu tarjeta.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">2. Para qué los usamos</h2>
            <p>
              Únicamente para prestar el servicio: responder mensajes, gestionar turnos y pedidos, enviarte
              recordatorios configurados y mostrarte tu actividad. No vendemos ni alquilamos datos a terceros y no
              hacemos publicidad con tu información.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">3. Los datos de tus clientes</h2>
            <p>
              Cuando tus clientes te escriben por WhatsApp, sus mensajes pasan por Boti para poder responder según tu
              configuración. Esos datos pertenecen a tu negocio: Boti actúa como encargado del tratamiento y solo
              los usa para operar el servicio. Si trabajás en rubros regulados (salud, finanzas), evaluá qué
              información permitís que circule por el chat.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">4. Tus chats son tuyos</h2>
            <p>
              Boti accede a tus mensajes solo para responder según tu configuración. Cada cuenta es independiente y
              podés desconectar tu número cuando quieras, lo que corta el acceso de inmediato.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">5. Cookies</h2>
            <p>
              Usamos únicamente cookies estrictamente necesarias para que la plataforma funcione: mantener tu sesión
              iniciada (cookie de autenticación) y seguridad. No usamos cookies de publicidad ni de seguimiento de
              terceros. Podés borrarlas desde tu navegador; al hacerlo, tendrás que iniciar sesión de nuevo.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">6. Cuánto tiempo guardamos los datos</h2>
            <p>
              Mantenemos tus datos mientras tu cuenta esté activa. Si cancelás o pedís la eliminación, borramos tu
              configuración y tus datos de operación (respuestas, turnos, pedidos, registros de mensajes). Podemos
              conservar comprobantes de pago el tiempo que exija la normativa fiscal.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">7. Tus derechos</h2>
            <p>
              Podés pedir acceso, corrección o eliminación de tus datos personales en cualquier momento desde tu
              panel o escribiéndonos por nuestros canales de soporte.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">8. Seguridad</h2>
            <p>
              Aplicamos controles de acceso, comunicación cifrada y buenas prácticas para proteger tu información.
              Ningún sistema es infalible: si detectamos un incidente que te afecte, te avisaremos.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-bold text-white">9. Cambios</h2>
            <p>
              Actualizaremos esta política cuando sea necesario e indicaremos la fecha de la última versión arriba.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
