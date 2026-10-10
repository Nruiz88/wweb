/* =========================================================
   /agendar sin slug
   =========================================================
   Antes esta ruta era la agenda pública y recibía `?business=<nombre>`.
   Ahora la agenda vive en `/agendar/<slug>`, y esta ruta se queda como
   el mensaje que ve quien escribe `/agendar` a mano o abre un enlace
   viejo.

   Se podría redirigir, pero no hay a dónde: sin slug no se sabe de qué
   negocio es. Decirlo es más honesto que un 404 sin explicación. */

export default function AgendaSinSlug() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b141a] px-4">
      <div className="mx-auto max-w-sm text-center text-white">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00a884]/15">
          <span className="text-xl">🗓️</span>
        </div>
        <h1 className="text-lg font-bold">Falta el enlace</h1>
        <p className="mt-2 text-sm text-white/60">
          La agenda se abre con un enlace que te da el negocio, con una dirección parecida a{" "}
          <span className="text-white/80">/agendar/&lt;nombre&gt;</span>.
        </p>
        <p className="mt-3 text-sm text-white/40">
          Si llegaste aquí desde un enlace viejo, pedile al negocio el nuevo.
        </p>
      </div>
    </div>
  );
}