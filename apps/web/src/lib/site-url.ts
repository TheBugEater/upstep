const PRODUCTION_URL = "https://upstep.dev";
const DEV_URL = "http://localhost:3000";

/**
 * Public base URL for the app (sitemap, emails, OG metadata, redirect targets, etc).
 * Derived from AUTH_URL, but never trusts a localhost value in production — that
 * env var is set for NextAuth's benefit, and a stale/misconfigured localhost
 * value there shouldn't leak into public-facing URLs.
 */
export function getSiteUrl(): string {
  const configured = process.env.AUTH_URL?.replace(/\/$/, "");
  const isProd = process.env.NODE_ENV === "production";

  if (configured && !(isProd && configured.includes("localhost"))) {
    return configured;
  }
  return isProd ? PRODUCTION_URL : DEV_URL;
}
