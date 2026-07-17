import { cookies, headers } from "next/headers";
import { type Currency, isCurrency } from "./plans";

export const CURRENCY_COOKIE = "upstep_currency";

// Eurozone country codes → EUR.
const EUR_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
]);

/**
 * Resolve the visitor's currency, in priority order:
 *   1. Manual override cookie (set by the currency switcher)
 *   2. Geo IP country header (Vercel / Cloudflare)
 *   3. Accept-Language hint
 *   4. USD fallback
 *
 * Reads request headers/cookies, so any page rendering this becomes dynamic.
 */
export async function detectCurrency(): Promise<Currency> {
  const cookieStore = await cookies();
  const override = cookieStore.get(CURRENCY_COOKIE)?.value?.toUpperCase();
  if (isCurrency(override)) return override;

  const h = await headers();

  const country = (
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    ""
  ).toUpperCase();

  if (country === "GB") return "GBP";
  if (EUR_COUNTRIES.has(country)) return "EUR";
  if (country) return "USD";

  // No geo header (e.g. local dev) - fall back to the browser locale.
  const lang = (h.get("accept-language") ?? "").toLowerCase();
  if (lang.includes("en-gb")) return "GBP";
  if (/\b(de|fr|es|it|nl|pt|fi|ga|el|et|lv|lt|sl|sk|mt|hr)\b/.test(lang)) return "EUR";

  return "USD";
}
