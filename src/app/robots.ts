import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/schema-org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/terminos", "/privacidad"],
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/settings/",
          "/profile/",
          "/calendar/",
          "/logs/",
          "/auto-responses/",
          "/whatsapp/",
          "/menus/",
          "/orders/",
          "/catalog/",
          "/plan/",
          "/login",
          "/register",
          "/reset-password",
          "/agendar",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
