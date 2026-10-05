import { MIS_SERVICIOS } from "@/lib/panel";

export default function SinAcceso() {
  return (
    <main
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
        <h1 style={{ fontSize: "1.25rem", marginBottom: ".75rem" }}>Tu bot no está activo</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.6 }}>
          Puede que la suscripción haya caducado o que se haya cancelado. Si crees que es un
          error, revísalo en el panel de Nexo Studio.
        </p>
        <a
          href={MIS_SERVICIOS}
          style={{ display: "inline-block", marginTop: "1.5rem", color: "#4da3ff" }}
        >
          Ir al panel de Nexo Studio
        </a>
      </div>
    </main>
  );
}