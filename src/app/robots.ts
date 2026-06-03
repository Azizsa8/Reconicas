// Next 16 app-router robots convention. Crawlers index marketing + docs +
// legal; everything under /app/* (and admin/api/transactional surfaces) is denied.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app")
    .trim()
    .replace(/\/+$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/ar",
          "/ar/pricing",
          "/demo",
          "/pricing",
          "/docs",
          "/docs/webhooks",
          "/security",
          "/changelog",
          "/roadmap",
          "/status",
          "/privacy",
          "/terms",
          "/cookies",
        ],
        disallow: ["/app/", "/api/", "/auth/", "/check-email", "/verify-mfa"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
