import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { randomUUID } from "node:crypto";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";
import robotsParser from "robots-parser";
import { db } from "../db";
import { SupportError, supportLimits } from "./policy";

const BOT = "UpStepBot";
const MAX_BYTES = 1_500_000;
export function normalizeDomain(input: string): string {
  let url: URL;
  try {
    url = new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    throw new SupportError("Enter a valid business domain.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !url.hostname.includes(".") ||
    ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ""))
  )
    throw new SupportError("Use a public HTTPS business domain.");
  return url.hostname.toLowerCase().replace(/^www\./, "");
}
export function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function crawlUrl(
  input: string,
  domain: string,
  base = `https://${domain}`,
) {
  try {
    const u = new URL(input, base);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      ![domain, `www.${domain}`].includes(u.hostname)
    )
      return null;
    if (
      /\.(?:pdf|png|jpg|jpeg|gif|svg|webp|zip|mp4|css|js|xml|json|ico|woff2?)$/i.test(
        u.pathname,
      )
    )
      return null;
    if (
      /(?:^|\/)(?:api|admin|login|logout|signin|signup|account|dashboard|checkout|cart|settings|auth)(?:\/|$)/i.test(
        decodeURIComponent(u.pathname),
      )
    )
      return null;
    u.hash = "";
    u.search = "";
    return u.href;
  } catch {
    return null;
  }
}

// Pin a public DNS answer for each request, including redirects. No arbitrary-port,
// local-network or credentialed requests, and no automatic cross-domain redirects.
export async function fetchBusinessPage(
  input: string,
  domain: string,
  redirects = 0,
): Promise<{ status: number; text: string; url: string; type: string }> {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    ![domain, `www.${domain}`].includes(url.hostname)
  )
    throw new Error("URL is outside the business domain");
  const answers = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => reject(new Error("DNS timeout")), 4000);
      t.unref();
    }),
  ]);
  if (!answers.length || answers.some((a) => !isPublicAddress(a.address)))
    throw new Error("Business domain must resolve to public addresses");
  const answer = answers[0]!;
  const result = await new Promise<{
    status: number;
    text: string;
    location?: string | undefined;
    type: string;
  }>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": `${BOT}/1.0 (+https://upstep.dev)`,
          Accept: "text/html,application/xml,text/plain",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, [answer]);
          else callback(null, answer.address, answer.family);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES)
            req.destroy(new Error("Page exceeds crawl size limit"));
          else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode || 500,
            text: Buffer.concat(chunks).toString("utf8"),
            location: response.headers.location,
            type: response.headers["content-type"] || "",
          }),
        );
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Crawl request timed out")),
      8000,
    );
    req.once("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    if (redirects >= 3) throw new Error("Too many redirects");
    return fetchBusinessPage(
      new URL(result.location, url).href,
      domain,
      redirects + 1,
    );
  }
  return { ...result, url: url.href };
}
export function extractKnowledge(html: string, url: string, domain: string) {
  const $ = load(html);
  const siteName =
    $('meta[property="og:site_name"]').attr("content")?.trim().slice(0, 80) ||
    null;
  const title = $("title").first().text().trim().slice(0, 200) || domain;
  const links = $("a[href]")
    .map((_, e) => crawlUrl($(e).attr("href") || "", domain, url))
    .get()
    .filter(Boolean) as string[];
  $(
    "script,style,noscript,svg,iframe,form,nav,footer,header,[hidden],[aria-hidden='true']",
  ).remove();
  $("br,p,li,h1,h2,h3,h4,tr,section,article").each((_, e) => {
    $(e).append("\n");
  });
  const content = ($("main").text() || $("article").text() || $("body").text())
    .replace(/[\t \u00a0]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, 40_000);
  return { title, siteName, content, links: [...new Set(links)] };
}
async function crawlRules(domain: string) {
  const robots = await fetchBusinessPage(
    `https://${domain}/robots.txt`,
    domain,
  );
  if (robots.status !== 404 && robots.status !== 410 && robots.status !== 200)
    throw new Error("Could not read robots.txt");
  return robotsParser(
    `https://${domain}/robots.txt`,
    robots.status === 200 ? robots.text : "",
  );
}
export async function processCrawlPage() {
  const stale = new Date(Date.now() - 2 * 60_000);
  const config = await db.supportConfig.findFirst({
    where: {
      enabled: true,
      project: { owner: { plan: { in: ["PRO", "BUSINESS"] } } },
      crawlState: { in: ["QUEUED", "CRAWLING"] },
      OR: [{ crawlLockedAt: null }, { crawlLockedAt: { lt: stale } }],
    },
    include: { project: { select: { owner: { select: { plan: true } } } } },
    orderBy: { updatedAt: "asc" },
  });
  if (!config) return false;
  const limits = supportLimits(config.project.owner.plan);
  if (!limits.enabled) return false;
  const lock = randomUUID();
  const claimed = await db.supportConfig.updateMany({
    where: {
      projectId: config.projectId,
      crawlGeneration: config.crawlGeneration,
      OR: [{ crawlLockedAt: null }, { crawlLockedAt: { lt: stale } }],
    },
    data: {
      crawlLock: lock,
      crawlLockedAt: new Date(),
      crawlState: "CRAWLING",
    },
  });
  if (!claimed.count) return false;
  const queue = Array.isArray(config.crawlQueue)
    ? config.crawlQueue.filter((x): x is string => typeof x === "string")
    : [];
  const visited = Array.isArray(config.crawlVisited)
    ? config.crawlVisited.filter((x): x is string => typeof x === "string")
    : [];
  let error: string | null = config.crawlError;
  try {
    const robots = await crawlRules(config.domain);
    if (!visited.length && !queue.length) {
      queue.push(`https://${config.domain}/`);
      const sitemapUrls = [
        ...robots.getSitemaps(),
        `https://${config.domain}/sitemap.xml`,
      ].slice(0, 1);
      for (const source of sitemapUrls) {
        try {
          const sitemap = await fetchBusinessPage(source, config.domain);
          if (sitemap.status !== 200) continue;
          const $ = load(sitemap.text, { xml: true });
          if ($("sitemapindex").length) {
            for (const nested of $("sitemap loc")
              .slice(0, 1)
              .map((_, e) => $(e).text())
              .get()) {
              const page = await fetchBusinessPage(nested, config.domain);
              if (page.status === 200) {
                const xml = load(page.text, { xml: true });
                xml("url loc")
                  .slice(0, limits.pages * 3)
                  .each((_, e) => {
                    const url = crawlUrl(xml(e).text(), config.domain);
                    if (url) queue.push(url);
                  });
              }
            }
          } else
            $("url loc")
              .slice(0, limits.pages * 3)
              .each((_, e) => {
                const url = crawlUrl($(e).text(), config.domain);
                if (url) queue.push(url);
              });
        } catch {
          /* Missing sitemap is normal; follow links from the home page. */
        }
      }
    }
    const next = queue.shift();
    if (next && !visited.includes(next)) {
      visited.push(next);
      if (robots.isAllowed(next, BOT) !== false) {
        try {
          const page = await fetchBusinessPage(next, config.domain);
          if (robots.isAllowed(page.url, BOT) === false)
            throw new Error("Redirect blocked by robots.txt");
          if (
            page.status !== 200 ||
            !/text\/html|application\/xhtml\+xml/i.test(page.type)
          )
            throw new Error("Page is not accessible HTML");
          const knowledge = extractKnowledge(
            page.text,
            page.url,
            config.domain,
          );
          if (knowledge.content.length >= 60) {
            await db.$transaction(async (tx) => {
              if (
                !(await tx.supportConfig.count({
                  where: {
                    projectId: config.projectId,
                    crawlGeneration: config.crawlGeneration,
                    crawlLock: lock,
                    enabled: true,
                  },
                }))
              )
                return;
              if (
                visited.length === 1 &&
                config.businessName === config.domain &&
                knowledge.siteName
              )
                await tx.supportConfig.updateMany({
                  where: { projectId: config.projectId, crawlLock: lock },
                  data: { businessName: knowledge.siteName },
                });
              await tx.supportKnowledgePage.upsert({
                where: {
                  projectId_generation_url: {
                    projectId: config.projectId,
                    generation: config.crawlGeneration,
                    url: page.url,
                  },
                },
                create: {
                  projectId: config.projectId,
                  generation: config.crawlGeneration,
                  url: page.url,
                  title: knowledge.title,
                  content: knowledge.content,
                },
                update: {
                  title: knowledge.title,
                  content: knowledge.content,
                  indexedAt: new Date(),
                },
              });
            });
          }
          queue.push(...knowledge.links);
        } catch {
          error =
            "Some pages could not be indexed. Check that they are public HTML and allow UpStepBot.";
        }
      }
    }
    const remaining = [...new Set(queue)]
      .filter((u) => !visited.includes(u))
      .slice(0, limits.pages * 3);
    const done = !remaining.length || visited.length >= limits.pages;
    const count = await db.supportKnowledgePage.count({
      where: {
        projectId: config.projectId,
        generation: config.crawlGeneration,
      },
    });
    await db.supportConfig.updateMany({
      where: {
        projectId: config.projectId,
        crawlGeneration: config.crawlGeneration,
        crawlLock: lock,
      },
      data: {
        crawlQueue: done ? [] : remaining,
        crawlVisited: visited,
        crawlState: done ? (count ? "READY" : "FAILED") : "CRAWLING",
        crawlLock: null,
        crawlLockedAt: null,
        crawlError:
          done && !count
            ? "No readable pages found. Check robots.txt and whether the site requires JavaScript or a login."
            : error,
        ...(done ? { crawledAt: new Date() } : {}),
      },
    });
  } catch {
    await db.supportConfig.updateMany({
      where: { projectId: config.projectId, crawlLock: lock },
      data: {
        crawlState: "FAILED",
        crawlLock: null,
        crawlLockedAt: null,
        crawlError:
          "Could not crawl this domain. Check HTTPS, public DNS, and robots.txt permissions.",
      },
    });
  }
  return true;
}
