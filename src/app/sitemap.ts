import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/schema-org";

/**
 * Sitemap dinámico. Solo incluyen rutas públicas indexables:
 * la landing y las páginas legales. El resto del sitio (dashboard,
 * APIs, /agendar con links por negocio) no debe aparecer en buscadores.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/terminos`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacidad`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
