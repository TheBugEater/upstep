import Stripe from "stripe";
import { getSiteUrl } from "./site-url";
import { isSelfHosted } from "./edition";

const key = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe client, or `null` when billing isn't configured (no secret key).
 * Routes should treat `null` as "billing disabled" and return 503 rather than
 * crash - this keeps the app fully runnable in local/dev without Stripe keys.
 */
export const stripe: Stripe | null = key
  ? new Stripe(key, { typescript: true })
  : null;

/** Checkout and the billing portal. Always off on a self-hosted install. */
export function billingEnabled(): boolean {
  return stripe !== null && !isSelfHosted();
}

/** Absolute base URL for redirect targets. */
export function appUrl(path = ""): string {
  return `${getSiteUrl()}${path}`;
}
