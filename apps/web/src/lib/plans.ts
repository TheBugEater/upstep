/**
 * Single source of truth for pricing tiers.
 *
 * Limits use `Infinity` to mean "unlimited" - never serialize a Plan directly
 * into a Client Component (Infinity becomes null over JSON). Read PLANS inside
 * Server Components, or pass only the primitive fields you need.
 */

import type { Prisma } from "@prisma/client";
import { isSelfHosted } from "./edition";

export type PlanId = "FREE" | "PRO" | "BUSINESS";

// ─── Currencies ───────────────────────────────────────────────────────────────

export const CURRENCIES = ["USD", "GBP", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<Currency, { symbol: string; label: string }> = {
  USD: { symbol: "$", label: "USD" },
  GBP: { symbol: "£", label: "GBP" },
  EUR: { symbol: "€", label: "EUR" },
};

/** Monthly amount per plan per currency (whole units, not cents). */
export const PRICE_MATRIX: Record<PlanId, Record<Currency, number>> = {
  FREE: { USD: 0, GBP: 0, EUR: 0 },
  PRO: { USD: 14.99, GBP: 11.99, EUR: 13.99 },
  BUSINESS: { USD: 49.99, GBP: 39.99, EUR: 44.99 },
};

export function isCurrency(v: string | null | undefined): v is Currency {
  return !!v && (CURRENCIES as readonly string[]).includes(v);
}

export function getPrice(planId: PlanId, currency: Currency): number {
  return PRICE_MATRIX[planId][currency];
}

export function formatPrice(planId: PlanId, currency: Currency): string {
  return `${CURRENCY_META[currency].symbol}${getPrice(planId, currency)}`;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Max projects per account. */
  projectLimit: number;
  /** Max feedback items per project. */
  feedbackLimit: number;
  /** Marketing bullet points. */
  features: string[];
  /** Whether the "Powered by Upstep" badge is shown in the widget. */
  branding: boolean;
  /** Stripe recurring (multi-currency) price id - undefined for free / unconfigured. */
  stripePriceId: string | undefined;
  /** Highlighted as the recommended tier on the pricing page. */
  popular?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Free",
    tagline: "Everything you need to start listening.",
    projectLimit: 1,
    feedbackLimit: 100,
    branding: true,
    stripePriceId: undefined,
    features: [
      "1 project",
      "Up to 100 feedback items",
      "Up & down voting",
      "Web, React Native & Flutter SDKs",
      "Widget customization (color, theme, position)",
      "Community support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    tagline: "For teams shipping real products.",
    projectLimit: 10,
    feedbackLimit: 5_000,
    branding: true,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    popular: true,
    features: [
      "Up to 10 projects",
      "Up to 5,000 items per project",
      "Everything in Free",
      "Live chat & shared support inbox",
      "AI support: 1,000 replies/month per account",
      "Learn from up to 40 website pages per project",
      "Private tickets from chat",
      "Email support",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    tagline: "For teams that ship together.",
    projectLimit: Infinity,
    feedbackLimit: Infinity,
    branding: false,
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
    features: [
      "Everything in Pro",
      "Unlimited projects",
      "Unlimited feedback items",
      "Remove Upstep branding",
      "AI support: 5,000 replies/month per account",
      "Learn from up to 150 website pages per project",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "BUSINESS"];

/** What every account gets on a self-hosted install: Business limits, no billing. */
export const SELF_HOSTED_PLAN: Plan = {
  ...PLANS.BUSINESS,
  name: "Self-hosted",
  tagline: "Every feature, no limits, on your own server.",
  stripePriceId: undefined,
  features: [
    "Unlimited projects and feedback items",
    "Live chat, shared support inbox and AI support",
    "No Upstep branding",
    "No billing: you run the server and the AI provider",
  ],
};

export function getPlan(id: string | null | undefined): Plan {
  if (isSelfHosted()) return SELF_HOSTED_PLAN;
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.FREE;
}

/** The plan an account is treated as: Business on a self-hosted install. */
export function effectivePlanId(id: string | null | undefined): PlanId {
  if (isSelfHosted()) return "BUSINESS";
  return id && id in PLANS ? (id as PlanId) : "FREE";
}

/** Whether paid features (support, integrations, custom domains) are on. */
export function isPaidPlan(id: string | null | undefined): boolean {
  return effectivePlanId(id) !== "FREE";
}

/**
 * Database filter for a project owner on a paid plan, e.g.
 * `project: { owner: paidOwnerWhere() }`. Matches every owner when self-hosted.
 */
export function paidOwnerWhere(): Prisma.UserWhereInput {
  return isSelfHosted() ? {} : { plan: { in: ["PRO", "BUSINESS"] } };
}

export function isUnlimited(n: number): boolean {
  return !Number.isFinite(n);
}

export function formatLimit(n: number): string {
  return isUnlimited(n) ? "Unlimited" : n.toLocaleString();
}

/** Reverse lookup: Stripe price id -> PlanId. Used by the webhook. */
export function planIdForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of PLAN_ORDER) {
    if (PLANS[id].stripePriceId && PLANS[id].stripePriceId === priceId) return id;
  }
  return null;
}
