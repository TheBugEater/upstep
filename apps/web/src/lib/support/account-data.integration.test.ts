import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { NextRequest } from "next/server";
import { accountSupportData, accountSupportProject, authorizeAccountConnector } from "./account-data";
import { usableActions, type ConnectorAction } from "./connectors";
import { GET } from "../../app/api/support/account/[customerId]/[section]/route";

const databaseUrl = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;
test("account support connectors isolate verified accounts and return only read-only billing fields", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.ok(url.pathname.endsWith("_test") || url.pathname === "/build");
  const client = new PrismaClient({ datasourceUrl: databaseUrl! });
  const savedEnv = { ...process.env };
  const key = "isolated-test-account-connector-key-123456";
  process.env.SUPPORT_ACCOUNT_CONNECTOR_KEY = key;
  process.env.AUTH_URL = "https://support.example.test";
  process.env.NEXT_PUBLIC_UPSTEP_BASE_URL = "https://support.example.test";
  const tag = randomUUID();
  const owner = await client.user.create({ data: { email: `platform-${tag}@example.test`, plan: "PRO" } });
  const a = await client.user.create({ data: { email: `a-${tag}@example.test`, plan: "PRO", stripeCustomerId: `cus_a_${tag}`, stripeSubscriptionId: `sub_a_${tag}` } });
  const b = await client.user.create({ data: { email: `b-${tag}@example.test`, plan: "BUSINESS", stripeCustomerId: `cus_b_${tag}` } });
  const guest = await client.user.create({ data: { email: `guest-${tag}@example.test` } });
  const users = [owner.id, a.id, b.id, guest.id];
  t.after(async () => {
    await client.project.deleteMany({ where: { ownerId: { in: users } } });
    await client.user.deleteMany({ where: { id: { in: users } } });
    await client.$disconnect();
    for (const name of ["SUPPORT_ACCOUNT_CONNECTOR_KEY", "AUTH_URL", "NEXT_PUBLIC_UPSTEP_BASE_URL", "NEXT_PUBLIC_UPSTEP_API_KEY"])
      if (savedEnv[name] === undefined) delete process.env[name]; else process.env[name] = savedEnv[name];
  });
  const support = await client.project.create({ data: {
    name: "Own support", slug: `self-${tag}`, ownerId: owner.id,
    supportConfig: { create: { enabled: true, domain: "support.example.test", businessName: "Upstep" } },
  } });
  process.env.NEXT_PUBLIC_UPSTEP_API_KEY = support.apiKey;
  const other = await client.project.create({ data: { name: "Other owner's private project", slug: `b-${tag}`, ownerId: b.id,
    members: { create: { userId: a.id, role: "ADMIN" } }, feedback: { create: { content: "Other owner's private feedback" } },
  } });
  const owned = await client.project.create({ data: { name: "A's project", slug: `a-${tag}`, ownerId: a.id,
    feedback: { create: [{ content: "One" }, { content: "Two" }] },
  } });
  await client.supportCustomer.createMany({ data: [
    { projectId: support.id, externalId: a.id, verified: true },
    { projectId: support.id, externalId: guest.id, verified: false },
    { projectId: other.id, externalId: b.id, verified: true },
  ] });
  await client.supportUsage.create({ data: { ownerId: a.id, month: "2026-11", aiReplies: 17, learningCalls: 2 } });
  const now = new Date("2026-11-19T12:00:00Z");

  await t.test("credential checks fail closed before looking up any account", async () => {
    assert.throws(() => authorizeAccountConnector(null), /Unauthorized/);
    assert.throws(() => authorizeAccountConnector("Bearer upstep_pk_public"), /Unauthorized/);
    assert.throws(() => authorizeAccountConnector("Bearer upstep_mcp_private"), /Unauthorized/);
    authorizeAccountConnector(`Bearer ${key}`);
    delete process.env.SUPPORT_ACCOUNT_CONNECTOR_KEY;
    assert.throws(() => authorizeAccountConnector(`Bearer ${key}`), /not configured/);
    process.env.SUPPORT_ACCOUNT_CONNECTOR_KEY = key;
    const response = await GET(new NextRequest("https://support.example.test/api/support/account/a/usage"), { params: Promise.resolve({ customerId: a.id, section: "usage" }) });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
  await t.test("other-project identities, unverified contacts and remote widgets cannot read local accounts", async () => {
    await assert.rejects(accountSupportData(b.id, "usage", client, null, now), /Account not available/);
    await assert.rejects(accountSupportData(guest.id, "usage", client, null, now), /Account not available/);
    await assert.rejects(accountSupportData("missing", "usage", client, null, now), /Account not available/);
    process.env.NEXT_PUBLIC_UPSTEP_BASE_URL = "https://another-instance.example.test";
    await assert.rejects(accountSupportProject(client), /not configured/);
    process.env.NEXT_PUBLIC_UPSTEP_BASE_URL = process.env.AUTH_URL;
    await client.supportConfig.update({ where: { projectId: support.id }, data: { enabled: false } });
    await assert.rejects(accountSupportProject(client), /not enabled/);
    await client.supportConfig.update({ where: { projectId: support.id }, data: { enabled: true } });
  });
  await t.test("usage is the account owner's monthly usage; joined projects and other owners are excluded", async () => {
    const usage = await accountSupportData(a.id, "usage", client, null, now);
    assert.ok("aiReplies" in usage);
    assert.deepEqual(usage.projects, { used: 1, limit: 10 });
    assert.deepEqual(usage.feedback, { totalAcrossOwnedProjects: 2, limitPerProject: 5000 });
    assert.equal(usage.aiReplies?.used, 17);
    assert.equal(usage.aiReplies?.month, "2026-11");
    const projects = await accountSupportData(a.id, "projects", client, null, now);
    assert.ok("scope" in projects);
    assert.deepEqual(projects.projects?.map((p) => p.name), [owned.name]);
    assert.ok(!JSON.stringify(projects).includes(owned.apiKey));
    await client.supportCustomer.create({ data: { projectId: support.id, externalId: b.id, verified: true } });
    const unlimited = await accountSupportData(b.id, "usage", client, null, now);
    assert.ok("feedback" in unlimited);
    assert.equal(unlimited.projects?.limit, null);
    assert.equal(unlimited.feedback?.limitPerProject, null);
    const response = await GET(new NextRequest("https://support.example.test/account", { headers: { authorization: `Bearer ${key}` } }),
      { params: Promise.resolve({ customerId: a.id, section: "usage" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).projects.used, 1);
  });
  await t.test("Stripe requests use the mapped customer and subscription, with bounded timeouts and no private fields", async () => {
    const calls: string[] = [];
    const billing = {
      subscriptions: { retrieve: async (id: string, _params: unknown, options: Stripe.RequestOptions) => {
        calls.push("subscription"); assert.equal(id, a.stripeSubscriptionId); assert.equal(options.timeout, 4000); assert.equal(options.maxNetworkRetries, 0);
        return { customer: a.stripeCustomerId, status: "active", cancel_at_period_end: false, cancel_at: null, trial_end: null,
          metadata: { secret: "must-not-leak" }, items: { data: [{ current_period_start: 1793577600, current_period_end: 1796169600,
            quantity: 1, price: { currency: "gbp", unit_amount: 1199, recurring: { interval: "month", interval_count: 1 } } }] } };
      } },
      invoices: { list: async (params: { customer: string; limit: number }, options: Stripe.RequestOptions) => {
        calls.push("invoices"); assert.deepEqual(params, { customer: a.stripeCustomerId, limit: 5 }); assert.equal(options.timeout, 4000);
        return { has_more: false, data: [{ customer: a.stripeCustomerId, number: "TEST-0001", status: "paid", currency: "gbp",
          amount_due: 1199, amount_paid: 1199, amount_remaining: 0, created: 1793577600, due_date: null, next_payment_attempt: null,
          status_transitions: { paid_at: 1793577600 }, customer_email: a.email, customer_address: { line1: "must-not-leak" },
          invoice_pdf: "https://billing.example.test/private", hosted_invoice_url: "https://billing.example.test/pay" }] };
      } },
    } as unknown as Stripe;
    const subscription = await accountSupportData(a.id, "billing", client, billing, now);
    assert.ok("subscription" in subscription);
    assert.equal(subscription.subscription?.status, "active");
    assert.equal(subscription.subscription?.items[0]?.unitAmountMinor, 1199);
    const invoices = await accountSupportData(a.id, "invoices", client, billing, now);
    assert.ok("invoices" in invoices);
    assert.equal(invoices.invoices?.[0]?.status, "paid");
    const output = JSON.stringify({ subscription, invoices });
    for (const excluded of [a.email, a.stripeCustomerId!, "must-not-leak", "invoice_pdf", "hosted_invoice_url"])
      assert.ok(!output.includes(excluded), excluded);
    assert.deepEqual(calls, ["subscription", "invoices"]);
    const mismatched = { subscriptions: { retrieve: async () => ({ customer: b.stripeCustomerId }) } } as unknown as Stripe;
    await assert.rejects(accountSupportData(a.id, "billing", client, mismatched, now), /temporarily unavailable/);
    await assert.rejects(accountSupportData(a.id, "invoices", client, null, now), /temporarily unavailable/);
    await client.supportCustomer.create({ data: { projectId: support.id, externalId: owner.id, verified: true } });
    const noBilling = await accountSupportData(owner.id, "billing", client, null, now);
    assert.ok("hasBillingAccount" in noBilling);
    assert.equal(noBilling.hasBillingAccount, false);
  });
  await t.test("customer account actions are unavailable to anonymous chat", () => {
    const action: ConnectorAction = { id: "billing", name: "get_billing", description: "Read this customer's billing status.",
      path: "/api/support/account/{customer_id}/billing", scope: "CUSTOMER", enabled: true, inputs: [], hiddenFields: [] };
    assert.deepEqual(usableActions([action], { externalId: a.id, email: a.email, verified: false }), []);
    assert.equal(usableActions([action], { externalId: a.id, email: a.email, verified: true }).length, 1);
  });
});
