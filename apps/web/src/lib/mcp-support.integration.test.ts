import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import { generateMcpKey, hashMcpKey } from "./mcp-credentials";

const databaseUrl = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test("MCP support setup applies reviews and connector changes within a personal key's project", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.ok(url.pathname.endsWith("_test") || url.pathname === "/build");
  process.env.SUPPORT_CONNECTOR_SECRET = "integration-connector-secret";
  // Next installs this global when booting the server, which direct route tests bypass.
  Object.assign(globalThis, { AsyncLocalStorage });
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { NextRequest } = await import("next/server");
  const db = new PrismaClient({ datasourceUrl: databaseUrl! });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = db;
  const { POST } = await import("../app/api/mcp/route");
  const { issuePersonalMcpKey } = await import("./mcp-access");

  const owner = await db.user.create({ data: { email: `${randomUUID()}@example.test`, plan: "PRO" } });
  const member = await db.user.create({ data: { email: `${randomUUID()}@example.test` } });
  t.after(async () => {
    await db.project.deleteMany({ where: { ownerId: owner.id } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
    await db.$disconnect();
  });
  const legacyKey = generateMcpKey();
  const project = await db.project.create({ data: {
    name: "Support setup", slug: randomUUID(), ownerId: owner.id, mcpKeyHash: hashMcpKey(legacyKey),
    members: { create: { userId: member.id, role: "MEMBER" } },
  } });
  const otherProject = await db.project.create({ data: { name: "Other", slug: randomUUID(), ownerId: owner.id } });
  const [ownerKey, memberKey, otherKey] = await Promise.all([
    issuePersonalMcpKey(project.id, owner.id),
    issuePersonalMcpKey(project.id, member.id),
    issuePersonalMcpKey(otherProject.id, owner.id),
  ]).then((results) => results.map(({ mcpKey }) => mcpKey));

  // Capture worker scheduling while keeping the test isolated from crawler and AI network calls.
  const scheduled: unknown[] = [];
  const requestContext = { afterContext: { after: (job: unknown) => scheduled.push(job) } } as unknown as WorkStore;
  async function rpc(method: string, params = {}, key = ownerKey) {
    const response = await workAsyncStorage.run(requestContext, () => POST(new NextRequest("http://localhost/api/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    })));
    assert.equal(response.status, 200);
    return (await response.json()).result;
  }
  async function call(name: string, args = {}, key = ownerKey) {
    return rpc("tools/call", { name, arguments: args }, key);
  }
  async function tool(name: string, args = {}, key = ownerKey) {
    const result = await call(name, args, key);
    assert.equal(result.isError, undefined, result.content[0].text);
    return JSON.parse(result.content[0].text);
  }
  const discovered = (await rpc("tools/list")).tools;
  assert.ok(discovered.find((entry: { name: string }) => entry.name === "save_support_connector")?.inputSchema.properties.connector);
  for (const key of [memberKey, legacyKey]) {
    assert.ok(!(await rpc("tools/list", {}, key)).tools.some((entry: { name: string }) => entry.name === "learn_support_website"));
    assert.equal((await call("learn_support_website", { domain: "example.com" }, key)).isError, true);
  }
  assert.equal((await tool("get_support_knowledge")).config, null);
  const { generation } = await tool("learn_support_website", { domain: "example.com" });
  assert.equal((await tool("learn_support_website", { domain: "example.com" })).generation, generation);
  assert.equal(scheduled.length, 2);
  assert.equal((await tool("get_support_knowledge")).config.learningState, "LEARNING");
  await db.supportConfig.update({ where: { projectId: project.id }, data: {
    crawlState: "READY", learningState: "REVIEW",
    learningAnalysis: {
      businessName: "Example", summary: "A test business.", supportEmail: "help@example.com",
      suggestedInstructions: "Use confirmed policies.", facts: [],
      questions: [{ id: "question_1", question: "Can customers cancel?", suggestion: "Check policy." }],
    },
  } });
  await db.supportKnowledgePage.create({ data: {
    projectId: project.id, generation, url: "https://example.com/faq", title: "FAQ", content: "Example FAQ",
  } });
  const knowledge = await tool("get_support_knowledge");
  assert.equal(knowledge.config.findings.questions[0].id, "question_1");
  assert.deepEqual(knowledge.pages.map((page: { url: string }) => page.url), ["https://example.com/faq"]);
  const review = {
    generation, businessName: "Example", supportEmail: "help@example.com",
    summary: "A test business.", instructions: "Use confirmed policies.",
    welcomeMessage: "How can we help?", enabled: true,
    facts: [{ label: "Support hours", value: "9 to 5" }],
    answers: { question_1: "Customers can cancel before shipment." },
  };
  assert.equal((await call("save_support_knowledge", { ...review, generation: generation + 1 })).isError, true);
  assert.equal((await call("save_support_knowledge", { ...review, enabled: undefined })).isError, true);
  assert.equal((await call("save_support_knowledge", { ...review, answers: {} })).isError, true);
  assert.equal((await tool("save_support_knowledge", review)).learningState, "READY");
  assert.equal((await tool("refresh_support_knowledge")).generation, generation + 1);
  const refreshed = await tool("get_support_knowledge");
  assert.equal(refreshed.config.enabled, true);
  assert.deepEqual(refreshed.config.profile.facts, review.facts);
  assert.equal(refreshed.config.profile.answers[0].answer, review.answers.question_1);
  assert.deepEqual(refreshed.pages, []);
  assert.equal(scheduled.length, 4);

  const connector = {
    name: "Orders", baseUrl: "https://api.example.com/v1", authType: "BEARER", enabled: true,
    actions: [{ id: "orders", name: "get_orders", description: "Look up a customer's orders.",
      path: "/customers/{customer_id}/orders", scope: "CUSTOMER", enabled: true, inputs: [], hiddenFields: ["phone"] }],
  };
  const secret = "fixture-auth-token";
  const [first, second] = await Promise.all([
    tool("save_support_connector", { connector: { ...connector, secret } }),
    tool("save_support_connector", { connector: { ...connector, secret } }),
  ]);
  assert.equal(first.connector.id, second.connector.id);
  assert.equal(Number(first.created) + Number(second.created), 1);
  const { id } = first.connector;
  assert.equal((await tool("save_support_connector", { id, connector: { ...connector, enabled: false } })).connector.hasSecret, true);
  assert.equal((await call("save_support_connector", { id, connector: { ...connector, baseUrl: "https://other.example.com" } })).isError, true);
  assert.equal((await call("save_support_connector", { id, connector }, otherKey)).isError, true);
  const list = await tool("list_support_connectors");
  assert.equal(list.connectors.length, 1);
  assert.equal(list.connectors[0].baseUrl, connector.baseUrl);
  assert.equal(list.connectors[0].secretHint, undefined);
  assert.equal(list.connectors[0].secretCipher, undefined);
  assert.ok(!JSON.stringify({ first, second, list }).includes(secret));
  assert.deepEqual((await tool("list_support_connectors", {}, otherKey)).connectors, []);

  await db.user.update({ where: { id: owner.id }, data: { plan: "FREE" } });
  assert.match((await call("list_support_connectors")).content[0].text, /paid plans/);
});
