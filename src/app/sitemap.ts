// Static sitemap for the public surface. Anything signed-in (/app/*),
// transactional (/auth/*), or operational (/api/*) is deliberately omitted.

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app")
    .trim()
    .replace(/\/+$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/ar`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/ar/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/docs/webhooks`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.75 },
    { url: `${base}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/roadmap`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: `${base}/status`, lastModified: now, changeFrequency: "always", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/cookies`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
