import { formatArs } from "./format";
import type { PublicPlan } from "./plans";

// Fallbacks para poder generar las FAQs sin acceso a la DB (p. ej. en build).
export const FALLBACK_FAQ_PLANS: PublicPlan[] = [
  {
    plan_type: "starter",
    label: "Starter",
    description: "Para pymes pequeñas",
    amount_pesos: 18000,
    max_instances: 1,
  },
  {
    plan_type: "pro",
    label: "Pro",
    description: "Para negocios en crecimiento",
    amount_pesos: 25000,
    max_instances: 3,
  },
];

export const FALLBACK_FAQ_ADDON_PRICE = 7000;

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQs de la landing. Fuente única para la UI y para el JSON-LD de FAQPage.
 * Recibe planes/precio para que las respuestas reflejen los valores reales.
 */
export function getLandingFaqs(
  plans: PublicPlan[] = [...FALLBACK_FAQ_PLANS],
  addonPrice: number = FALLBACK_FAQ_ADDON_PRICE
): FaqItem[] {
  const starter = plans.find((p) => p.plan_type === "starter") ?? FALLBACK_FAQ_PLANS[0];
  const pro = plans.find((p) => p.plan_type === "pro") ?? FALLBACK_FAQ_PLANS[1];

  return [
    {
      question: "¿Qué pasa si empiezo con Starter y necesito turnos después?",
      answer:
        "Podés subir a Pro cuando quieras desde tu panel: se desbloquean calendario, recordatorios y catálogo sin volver a configurar nada.",
    },
    {
      question: "¿Qué es el 'link público para agendar'?",
      answer:
        "Es una página que te da Boti (bot.panel-niconqn.duckdns.org/agendar?business=tu-negocio) donde tus clientes eligen día y hora solos, sin escribirte. Ideal para ponerla en el bio de Instagram.",
    },
    {
      question: "¿Cuántos números de WhatsApp puedo conectar?",
      answer: `Depende del plan: ${starter.label} incluye ${starter.max_instances} bot y ${pro.label} incluye ${pro.max_instances}. Si necesitás más, sumá bots extra por ${formatArs(addonPrice)} al mes cada uno.`,
    },
    {
      question: "¿Necesito saber de programación?",
      answer:
        "No. Todo se configura desde un panel simple: escribís las respuestas como si fuera un chat y listo.",
    },
    {
      question: "¿Cómo pago y cómo cancelo?",
      answer:
        "Con Mercado Pago, en pesos argentinos. Podés cancelar cuando quieras desde tu panel: el servicio sigue activo hasta el fin del mes ya pagado.",
    },
  ];
}
