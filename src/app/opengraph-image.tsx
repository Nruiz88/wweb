import { ImageResponse } from "next/og";

// Imagen Open Graph / Twitter dinámica (1200x630), generada en el build.
// Verde WhatsApp sobre fondo oscuro, consistente con la identidad de la landing.

export const alt = "Boti - Tu asistente de WhatsApp";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a151a 0%, #0d1f1a 60%, #0a151a 100%)",
          position: "relative",
        }}
      >
        {/* Glow de fondo */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: 200,
            width: 800,
            height: 800,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(37,211,102,0.18) 0%, transparent 65%)",
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "2px solid rgba(37,211,102,0.35)",
            background: "rgba(37,211,102,0.08)",
            borderRadius: 9999,
            padding: "10px 28px",
            marginBottom: 40,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 9999, background: "#25d366" }} />
          <div style={{ fontSize: 26, fontWeight: 700, color: "#25d366", letterSpacing: 2 }}>
            HECHO PARA EMPRENDEDORES ARGENTINOS
          </div>
        </div>

        {/* Título */}
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: "#ffffff" }}>
          Tu negocio
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: "#25d366" }}>
          nunca duerme
        </div>

        {/* Subtítulo */}
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#8696a0",
            marginTop: 36,
          }}
        >
          Responde solo · Agenda turnos · Toma pedidos · 24/7
        </div>
      </div>
    ),
    { ...size }
  );
}
