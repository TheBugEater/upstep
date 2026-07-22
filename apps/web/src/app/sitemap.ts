import type { MetadataRoute } from "next";
import { COMPETITORS } from "./alternatives/data";
import { INTEGRATIONS } from "./integrations/data";
import { USE_CASES } from "./use-cases/data";
import { BLOG_POSTS } from "./blog/data";
import { TOOLS } from "./tools/data";
import { GUIDES } from "./guides/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.AUTH_URL ?? "https://upstep.dev").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/feedback-board`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/alternatives`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(COMPETITORS).map((slug) => ({
      url: `${base}/alternatives/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/integrations`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(INTEGRATIONS).map((slug) => ({
      url: `${base}/integrations/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/use-cases`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(USE_CASES).map((slug) => ({
      url: `${base}/use-cases/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(TOOLS).map((slug) => ({
      url: `${base}/tools/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(GUIDES).map((slug) => ({
      url: `${base}/guides/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...Object.values(BLOG_POSTS).map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
