import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { COMPETITORS } from "./alternatives/data";
import { INTEGRATIONS } from "./integrations/data";
import { USE_CASES } from "./use-cases/data";
import { BLOG_POSTS } from "./blog/data";
import { TOOLS } from "./tools/data";
import { GUIDES } from "./guides/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    // Do not claim that every static page changed on every sitemap request.
    // Omitting lastModified is more accurate until each content type has a
    // source-of-truth publish/update date.
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/feedback-board`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/alternatives`, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(COMPETITORS).map((slug) => ({
      url: `${base}/alternatives/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${base}/integrations`, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(INTEGRATIONS).map((slug) => ({
      url: `${base}/integrations/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/use-cases`, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(USE_CASES).map((slug) => ({
      url: `${base}/use-cases/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/tools`, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(TOOLS).map((slug) => ({
      url: `${base}/tools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${base}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...Object.keys(GUIDES).map((slug) => ({
      url: `${base}/guides/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.6 },
    ...Object.values(BLOG_POSTS).map((post) => ({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    { url: `${base}/legal/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
