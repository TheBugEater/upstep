import type { MetadataRoute } from "next";

const ALTERNATIVE_SLUGS = ["canny", "uservoice", "productboard"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.AUTH_URL ?? "https://upstep.dev").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...ALTERNATIVE_SLUGS.map((slug) => ({
      url: `${base}/alternatives/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
