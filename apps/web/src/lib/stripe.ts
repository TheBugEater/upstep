import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

/**
 * Stripe client, or `null` when billing isn't configured (no secret key).
 * Routes should treat `null` as "billing disabled" and return 503 rather than
 * crash - this keeps the app fully runnable in local/dev without Stripe keys.
 */
export const stripe: Stripe | null = key
  ? new Stripe(key, { typescript: true })
  : null;

export function billingEnabled(): boolean {
  return stripe !== null;
}

/** Absolute base URL for redirect targets. */
export function appUrl(path = ""): string {
  const base =
    process.env.AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  return `${base}${path}`;
}
