// Next 16 app-router robots convention. Crawlers index marketing + docs +
// legal; everything under /app/* (and admin/api) is denied.

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app").trim().replace(/\/+$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/docs/webhooks", "/privacy", "/terms", "/cookies"],
        disallow: ["/app/", "/api/", "/auth/", "/check-email", "/verify-mfa"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
