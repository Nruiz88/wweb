import type { PublicPlan } from "./plans";
import { getLandingFaqs } from "./faq";

// URL canónica de producción (coincide con metadataBase del layout).
export const SITE_URL = "https://bot.panel-niconqn.duckdns.org";

const SITE_NAME = "Boti";
const SITE_DESCRIPTION =
  "Asistente virtual de WhatsApp para pymes argentinas: responde solo, agenda turnos y toma pedidos, 24/7.";

/**
 * Datos estructurados JSON-LD de la home.
 * Fuente única para el <script type="application/ld+json"> que se renderiza
 * server-side; los precios vienen de plan_config vía getPublicPlans().
 */
export function buildLandingJsonLd(plans: PublicPlan[], addonPrice: number): object[] {
  const plansList = plans && plans.length > 0 ? plans : [];

  const starter = plansList.find((p) => p.plan_type === "starter");
  const pro = plansList.find((p) => p.plan_type === "pro");

  // ── Organization ────────────────────────────────────────────────────────
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    areaServed: { "@type": "Country", name: "Argentina" },
    // WhatsApp es la forma de contacto principal del servicio.
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `${SITE_URL}/register`,
        availableLanguage: ["es"],
      },
    ],
  };

  // ── Products: un Product por plan, con precio real de plan_config ──────
  const planToProduct = (
    plan: PublicPlan,
    opts: { tagline: string; recommended?: boolean }
  ) => ({
    "@type": "Product",
    "@id": `${SITE_URL}/#plan-${plan.plan_type}`,
    name: `Boti ${plan.label}`,
    description:
      (plan.description ? `${plan.description}. ` : "") +
      `${opts.tagline} Bot de WhatsApp con respuestas automáticas${
        plan.plan_type === "pro"
          ? ", agenda de turnos, recordatorios y catálogo de productos"
          : " y menús interactivos"
      }. Incluye ${plan.max_instances} bot${plan.max_instances === 1 ? "" : "s"} conectado${
        plan.max_instances === 1 ? "" : "s"
      }.`,
    brand: { "@type": "Brand", name: SITE_NAME },
    category: "Software as a Service",
    ...(opts.recommended
      ? { award: "Plan recomendado para negocios en crecimiento" }
      : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: Math.round(plan.amount_pesos),
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/register`,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: Math.round(plan.amount_pesos),
        priceCurrency: "ARS",
        billingDuration: 1,
        billingIncrement: 1,
        unitCode: "MON",
        valueAddedTaxIncluded: true,
      },
    },
  });

  const products: object[] = [];
  if (starter) {
    products.push(planToProduct(starter, { tagline: "Atención automática básica para pymes." }));
  }
  if (pro) {
    products.push(
      planToProduct(pro, { tagline: "Gestión avanzada con turnos y pedidos.", recommended: true })
    );
  }
  // Add-on bot extra (precio de mercado_pago_config).
  if (addonPrice > 0) {
    products.push({
      "@type": "Product",
      "@id": `${SITE_URL}/#plan-addon-bot-extra`,
      name: "Boti - Bot / número extra",
      description:
        "Add-on mensual para sumar un número de WhatsApp adicional a cualquier plan: separá ventas, soporte o sucursales.",
      brand: { "@type": "Brand", name: SITE_NAME },
      category: "Software as a Service",
      offers: {
        "@type": "Offer",
        priceCurrency: "ARS",
        price: Math.round(addonPrice),
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/register`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: Math.round(addonPrice),
          priceCurrency: "ARS",
          billingDuration: 1,
          billingIncrement: 1,
          unitCode: "MON",
          valueAddedTaxIncluded: true,
        },
      },
    });
  }

  // ── WebSite ─────────────────────────────────────────────────────────────
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "es-AR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  // ── FAQPage (misma fuente que la UI) ────────────────────────────────────
  const faqPage = {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: getLandingFaqs(plansList, addonPrice).map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization, website, ...products, faqPage],
  };

  return [graph];
}
