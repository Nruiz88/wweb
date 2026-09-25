import type { Metadata } from "next";
import { getPublicPlans } from "@/lib/plans";
import { buildLandingJsonLd } from "@/lib/schema-org";
import Landing from "@/components/Landing";

// Render dinámico: los precios se leen de plan_config en cada request
// (si quedara estático, el build congelaría los valores del momento del deploy).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boti - Tu asistente de WhatsApp",
  description:
    "Boti es tu asistente virtual de WhatsApp. Responde automáticamente tus clientes, gestiona turnos y recibe pedidos, 24 horas, los 7 días. Sin contratar a nadie, sin saber de código.",
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const { plans, addon_price_pesos } = await getPublicPlans();
  const jsonLd = buildLandingJsonLd(plans, addon_price_pesos);

  return (
    <>
      {/* Datos estructurados schema.org (Organization, Product, WebSite, FAQPage) */}
      {jsonLd.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj).replace(/</g, "\\u003c") }}
        />
      ))}
      <Landing plans={plans} addonPrice={addon_price_pesos} />
    </>
  );
}
