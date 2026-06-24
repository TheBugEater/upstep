/**
 * Creates (or reuses) the Stripe Products and multi-currency Prices for the
 * paid plans, then prints the env vars to copy into `.env`.
 *
 * Each plan gets ONE recurring Price that supports USD, GBP and EUR via Stripe
 * `currency_options`, so checkout can charge in the visitor's currency while we
 * keep a single `STRIPE_PRICE_<PLAN>` env var per plan.
 *
 * Usage:
 *   pnpm --filter @upstep/web stripe:prices
 *   # or from apps/web:  pnpm stripe:prices
 *
 * Requires STRIPE_SECRET_KEY in apps/web/.env
 */
import Stripe from "stripe";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PLAN_ORDER,
  PLANS,
  PRICE_MATRIX,
  CURRENCIES,
  type Currency,
  type PlanId,
} from "../src/lib/plans";

// Load apps/web/.env (Node 20.12+).
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  // env may already be present in the shell — carry on
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✖ STRIPE_SECRET_KEY is not set. Add it to apps/web/.env first.");
  process.exit(1);
}

const stripe = new Stripe(key, { typescript: true });

/** PlanId -> { usd:100, currency_options:{ gbp:{unit_amount}, eur:{unit_amount} } } */
function priceData(planId: PlanId) {
  const base: Currency = "USD";
  const others = CURRENCIES.filter((c) => c !== base);
  const currency_options: Record<string, { unit_amount: number }> = {};
  for (const c of others) {
    currency_options[c.toLowerCase()] = { unit_amount: Math.round(PRICE_MATRIX[planId][c] * 100) };
  }
  return {
    currency: base.toLowerCase(),
    unit_amount: Math.round(PRICE_MATRIX[planId][base] * 100),
    currency_options,
  };
}

async function upsertProduct(planId: PlanId) {
  const plan = PLANS[planId];
  const existing = await stripe.products.list({ active: true, limit: 100 });
  const found = existing.data.find((p) => p.metadata?.upstep_plan === planId);
  if (found) return found;

  return stripe.products.create({
    name: `Upstep ${plan.name}`,
    description: plan.tagline,
    metadata: { upstep_plan: planId },
  });
}

async function upsertPrice(planId: PlanId, productId: string) {
  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const found = prices.data.find(
    (p) => p.recurring?.interval === "month" && p.metadata?.upstep_plan === planId
  );
  if (found) return { price: found, reused: true };

  const data = priceData(planId);
  const price = await stripe.prices.create({
    product: productId,
    currency: data.currency,
    unit_amount: data.unit_amount,
    currency_options: data.currency_options,
    recurring: { interval: "month" },
    metadata: { upstep_plan: planId },
  });
  return { price, reused: false };
}

async function main() {
  const paidPlans = PLAN_ORDER.filter((id) => id !== "FREE");
  const envLines: string[] = [];

  console.log("\n→ Setting up Stripe products & multi-currency prices…\n");

  for (const planId of paidPlans) {
    const product = await upsertProduct(planId);
    const { price, reused } = await upsertPrice(planId, product.id);

    const amounts = CURRENCIES.map(
      (c) => `${c} ${PRICE_MATRIX[planId][c]}`
    ).join("  ·  ");

    console.log(`  ${PLANS[planId].name.padEnd(9)} ${reused ? "reused" : "created"}  ${price.id}`);
    console.log(`            ${amounts}`);
    envLines.push(`STRIPE_PRICE_${planId}="${price.id}"`);
  }

  console.log("\n✔ Done. Add these to apps/web/.env:\n");
  console.log(envLines.join("\n"));
  console.log("");
}

main().catch((err) => {
  console.error("\n✖ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
