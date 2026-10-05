"use client";

import { useEffect, useState } from "react";
import { MIS_SERVICIOS } from "@/lib/panel";

/* =========================================================
   /entrar#<ticket>
   ---------------------------------------------------------
   El ticket viene en el FRAGMENTO, que el navegador no manda al
   servidor. Por eso no puede canjearse en el servidor: tiene que
   leerlo este JavaScript y hacer POST a /api/entrar.

   Si el ticket fuera un query param (?ticket=...), el access_token
   que lleva dentro acabaría en los logs del proxy, en el historial del
   navegador y en las cabeceras de petición.

   El `?next=` es la página que el proxy guardó cuando no había
   sesión, para volver a ella después de entrar.

   Al terminar se borra el fragmento con `history.replaceState`, para
   que el token no se quede en la barra si el usuario copia la URL.
   ========================================================= */

export default function Entrar() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ticket = window.location.hash.replace(/^#/, "").trim();
    const destino = new URLSearchParams(window.location.search).get("next") || "/dashboard";

    /* Sin ticket: el enlace vino mal, o se recargó la página después de
       canjear. Se vuelve al panel, que rehace el viaje. Antes se iba a
       /api/salir, que ya no existe. */
    if (!ticket) {
      window.location.replace(MIS_SERVICIOS);
      return;
    }

    let vivo = true;

    (async () => {
      try {
        const r = await fetch("/api/entrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket }),
        });
        const datos = (await r.json()) as { ok?: boolean; error?: string };

        if (!vivo) return;

        if (!r.ok || !datos.ok) {
          setError(datos.error || "No se pudo iniciar la sesión.");
          return;
        }

        /* El token ya está canjeado. Se quita el fragmento ANTES de
           navegar, para que no acabe en el historial. */
        window.history.replaceState(null, "", "/entrar");

        /* `next` viene de la URL, así que solo se aceptan rutas
           internas. Aceptarlo tal cual sería una redirección abierta:
           un enlace del panel podría mandar al usuario a cualquier
           sitio. Y tiene que empezar por UN barra: "//ejemplo.com" es
           una URL absoluta disfrazada. */
        const volver =
          destino.startsWith("/") && !destino.startsWith("//") ? destino : "/dashboard";

        window.location.replace(volver);
      } catch {
        if (vivo) setError("No se pudo conectar. Revisa la conexión e inténtalo otra vez.");
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return (
    /* El data-panel deja la dirección del panel en el HTML, no solo en
       el JavaScript del bundle. Sirve para dos cosas: comprobar que el
       despliegue tiene el dominio bueno puesto (si no, aquí sale el de
       desarrollo y se ve enseguida) y que los enlaces de vuelta se
       puedan leer sin ejecutar nada. */
    <main
      data-panel={MIS_SERVICIOS}
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#0b0f14",
        color: "#e6edf3",
      }}
    >
      <div style={{ maxWidth: "28rem", textAlign: "center" }}>
        {error ? (
          <>
            <h1 style={{ fontSize: "1.25rem", marginBottom: ".75rem" }}>No se pudo entrar</h1>
            <p style={{ opacity: 0.75, lineHeight: 1.6 }}>{error}</p>
            <a
              href={MIS_SERVICIOS}
              style={{ display: "inline-block", marginTop: "1.5rem", color: "#4da3ff" }}
            >
              Volver al panel
            </a>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.25rem", marginBottom: ".75rem" }}>Abriendo tu bot…</h1>
            <p style={{ opacity: 0.75 }}>Un momento.</p>
          </>
        )}
      </div>
    </main>
  );
}