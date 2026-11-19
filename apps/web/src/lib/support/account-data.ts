import { createHash, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "../db";
import { getPlan } from "../plans";
import { getSiteUrl } from "../site-url";
import { stripe } from "../stripe";
import { SupportError, supportLimits, usageMonth } from "./policy";

export const ACCOUNT_SECTIONS = ["billing", "invoices", "usage", "projects"] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];
const stripeOptions = { timeout: 4000, maxNetworkRetries: 0 };
const iso = (seconds: number | null | undefined) =>
  seconds == null ? null : new Date(seconds * 1000).toISOString();
const finiteLimit = (value: number) => Number.isFinite(value) ? value : null;

// A dedicated read-only credential. SDK keys, sessions and MCP keys do not
// authorize this service; authentication runs before any customer lookup.
export function authorizeAccountConnector(authorization: string | null) {
  const secret = process.env.SUPPORT_ACCOUNT_CONNECTOR_KEY;
  if (!secret || secret.length < 32)
    throw new SupportError("Account support lookups are not configured.", 503);
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const supplied = createHash("sha256").update(authorization || "").digest();
  if (!timingSafeEqual(expected, supplied)) throw new SupportError("Unauthorized", 401);
}

// These lookups are for Upstep's own support widget, not arbitrary customer
// projects. Only a same-instance widget can issue identities for local users.
export async function accountSupportProject(client: PrismaClient = db) {
  const apiKey = process.env.NEXT_PUBLIC_UPSTEP_API_KEY;
  let sameInstance = false;
  try {
    sameInstance = new URL(process.env.NEXT_PUBLIC_UPSTEP_BASE_URL || "").origin === new URL(getSiteUrl()).origin;
  } catch { /* fail closed */ }
  if (!apiKey || !sameInstance)
    throw new SupportError("Account support lookups are not configured.", 503);
  const project = await client.project.findUnique({
    where: { apiKey },
    select: { id: true, owner: { select: { plan: true } }, supportConfig: { select: { enabled: true } } },
  });
  if (!project?.supportConfig?.enabled || !supportLimits(project.owner.plan).enabled)
    throw new SupportError("Account support lookups are not enabled.", 503);
  return project;
}

export async function accountSupportData(
  customerId: string,
  section: AccountSection,
  client: PrismaClient = db,
  billing: Stripe | null = stripe,
  now = new Date(),
) {
  const project = await accountSupportProject(client);
  const customer = await client.supportCustomer.findUnique({
    where: { projectId_externalId: { projectId: project.id, externalId: customerId } },
    select: { verified: true },
  });
  if (!customer?.verified) throw new SupportError("Account not available.", 404);
  const user = await client.user.findUnique({
    where: { id: customerId },
    select: { id: true, plan: true, createdAt: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!user) throw new SupportError("Account not available.", 404);
  const plan = getPlan(user.plan);
  const base = { plan: plan.name, checkedAt: now.toISOString() };

  if (section === "usage") {
    const month = usageMonth(now);
    const [projectCount, feedback, usage] = await Promise.all([
      client.project.count({ where: { ownerId: user.id } }),
      client.feedback.count({ where: { project: { ownerId: user.id } } }),
      client.supportUsage.findUnique({ where: { ownerId_month: { ownerId: user.id, month } } }),
    ]);
    const limits = supportLimits(user.plan);
    return {
      ...base, projects: { used: projectCount, limit: finiteLimit(plan.projectLimit) },
      feedback: { totalAcrossOwnedProjects: feedback, limitPerProject: finiteLimit(plan.feedbackLimit) },
      aiReplies: { used: usage?.aiReplies || 0, limit: limits.aiReplies, month, timezone: "UTC", sharedAcrossOwnedProjects: true },
      websiteLearning: { used: usage?.learningCalls || 0, limit: limits.learningRuns, month },
      knowledgePagesPerProject: limits.pages, unlimitedLimitValue: null,
    };
  }
  if (section === "projects") {
    const projects = await client.project.findMany({
      where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, take: 11,
      select: {
        name: true, moderationEnabled: true,
        supportConfig: { select: { enabled: true, crawlState: true } },
        _count: { select: { feedback: true, members: true } },
      },
    });
    return {
      ...base, scope: "owned_projects", hasMore: projects.length > 10,
      projects: projects.slice(0, 10).map((p) => ({
        name: p.name, feedbackItems: p._count.feedback,
        feedbackLimit: finiteLimit(plan.feedbackLimit), moderationEnabled: p.moderationEnabled,
        teammates: p._count.members, supportEnabled: p.supportConfig?.enabled || false,
        knowledgeState: p.supportConfig?.crawlState || "NOT_CONFIGURED",
      })),
    };
  }
  // A manually assigned plan need not have a Stripe subscription. Distinguish
  // "no billing account" from an unavailable Stripe service or a failed lookup.
  if (!user.stripeCustomerId)
    return { ...base, hasBillingAccount: false, ...(section === "invoices" ? { invoices: [], hasMore: false } : { subscription: null }) };
  if (!billing) throw new SupportError("Billing information is temporarily unavailable.", 503);
  try {
    if (section === "billing") {
      if (!user.stripeSubscriptionId) return { ...base, hasBillingAccount: true, subscription: null };
      const sub = await billing.subscriptions.retrieve(user.stripeSubscriptionId, {}, stripeOptions);
      const owner = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      if (owner !== user.stripeCustomerId) throw new Error("Customer mismatch");
      return {
        ...base, hasBillingAccount: true, subscription: {
          status: sub.status, cancelAtPeriodEnd: sub.cancel_at_period_end,
          cancelAt: iso(sub.cancel_at), trialEnd: iso(sub.trial_end),
          items: sub.items.data.slice(0, 5).map((item) => ({
            currentPeriodStart: iso(item.current_period_start), currentPeriodEnd: iso(item.current_period_end),
            currency: item.price.currency, unitAmountMinor: item.price.unit_amount,
            quantity: item.quantity ?? 1, interval: item.price.recurring?.interval ?? null,
            intervalCount: item.price.recurring?.interval_count ?? null,
          })),
        }, amountUnit: "smallest_currency_unit",
      };
    }
    const invoices = await billing.invoices.list({ customer: user.stripeCustomerId, limit: 5 }, stripeOptions);
    if (invoices.data.some((invoice) => (typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id) !== user.stripeCustomerId))
      throw new Error("Customer mismatch");
    return {
      ...base, hasBillingAccount: true, hasMore: invoices.has_more, amountUnit: "smallest_currency_unit",
      invoices: invoices.data.map((invoice) => ({
        number: invoice.number, status: invoice.status, currency: invoice.currency,
        amountDueMinor: invoice.amount_due, amountPaidMinor: invoice.amount_paid,
        amountRemainingMinor: invoice.amount_remaining, createdAt: iso(invoice.created),
        dueAt: iso(invoice.due_date), paidAt: iso(invoice.status_transitions.paid_at),
        nextPaymentAttempt: iso(invoice.next_payment_attempt),
      })),
    };
  } catch {
    // Never return provider errors, request IDs, credentials or raw objects.
    throw new SupportError("Billing information is temporarily unavailable. Please ask the team to investigate.", 502);
  }
}
