import { load } from "cheerio";
import { isIP } from "node:net";
import { fetchBusinessPage, isPublicAddress } from "./crawler";

/** Branding is public. Accept HTTPS assets or small, rasterized PNG uploads. */
export function normalizeBusinessLogo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (raw.length > 180000) return null;
  if (raw.startsWith("data:image/png;base64,")) {
    const data = raw.slice(22);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
    const bytes = Buffer.from(data, "base64");
    if (
      bytes.length < 24 ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.subarray(12, 16).toString() !== "IHDR"
    )
      return null;
    const width = bytes.readUInt32BE(16),
      height = bytes.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 512 && height <= 512
      ? raw
      : null;
  }
  if (raw.length > 2048) return null;
  try {
    const u = new URL(raw);
    if (
      u.protocol !== "https:" ||
      u.port ||
      u.username ||
      u.password ||
      !u.hostname.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname)
    )
      return null;
    if (
      isIP(u.hostname.replace(/^\[|\]$/g, "")) &&
      !isPublicAddress(u.hostname.replace(/^\[|\]$/g, ""))
    )
      return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}
export function businessLogo(profile: unknown): string | null {
  const p = profile as { branding?: { logoUrl?: unknown } } | null;
  return normalizeBusinessLogo(p?.branding?.logoUrl);
}
export function extractBusinessLogo(
  html: string,
  pageUrl: string,
): string | null {
  const $ = load(html),
    candidates: { url: string; score: number }[] = [];
  const add = (source: unknown, score: number) => {
    if (typeof source !== "string" || source.startsWith("data:")) return;
    try {
      const url = normalizeBusinessLogo(new URL(source, pageUrl).href);
      if (url) candidates.push({ url, score });
    } catch {}
  };
  $("link[href]").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase().split(/\s+/);
    if (rel.includes("apple-touch-icon")) add($(el).attr("href"), 100);
    else if (rel.includes("icon")) {
      const size = parseInt($(el).attr("sizes") || "0", 10);
      add(
        $(el).attr("href"),
        /svg/i.test($(el).attr("type") || "") ? 95 : size >= 64 ? 90 : 60,
      );
    }
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const queue: unknown[] = [JSON.parse($(el).text())];
      for (let n = 0; queue.length && n < 100; n++) {
        const value = queue.shift();
        if (Array.isArray(value)) {
          queue.push(...value.slice(0, 30));
          continue;
        }
        if (!value || typeof value !== "object") continue;
        const node = value as Record<string, unknown>;
        if (node.logo) {
          const logo = node.logo;
          add(
            typeof logo === "object" ? (logo as { url?: unknown }).url : logo,
            85,
          );
        }
        if (Array.isArray(node["@graph"]))
          queue.push(...node["@graph"].slice(0, 30));
      }
    } catch {}
  });
  $("header img").each((_, el) =>
    add($(el).attr("src") || $(el).attr("data-src"), 75),
  );
  $("img[alt]").each((_, el) => {
    if (/logo/i.test($(el).attr("alt") || ""))
      add($(el).attr("src") || $(el).attr("data-src"), 70);
  });
  return candidates.sort((a, b) => b.score - a.score)[0]?.url || null;
}
export async function discoverBusinessLogo(
  domain: string,
): Promise<string | null> {
  try {
    const page = await fetchBusinessPage(`https://${domain}/`, domain);
    if (page.status === 200) {
      const logo = extractBusinessLogo(page.text, page.url);
      if (logo) return logo;
    }
  } catch {
    /* A favicon can still be available when the page cannot be indexed. */
  }
  try {
    const icon = await fetchBusinessPage(
      `https://${domain}/favicon.ico`,
      domain,
    );
    return icon.status === 200 && icon.type.startsWith("image/")
      ? normalizeBusinessLogo(icon.url)
      : null;
  } catch {
    return null;
  }
}
