import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient, type Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { generateMcpKey, hashMcpKey } from "./mcp-credentials";

const databaseUrl = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test("MCP task workflow updates real columns, lifecycle filters, and notifications", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.ok(url.pathname.endsWith("_test") || url.pathname === "/build");
  const client = new PrismaClient({ datasourceUrl: databaseUrl! });
  // Exercise real RPC writes without delivering any test database notification jobs.
  const queue = new Proxy(client.notificationJob, {
    get(target, property) {
      // Other test files run real queue retries concurrently. Keep our jobs out
      // of their delivery window while still asserting that RPC calls queue them.
      if (property === "create") return (args: Prisma.NotificationJobCreateArgs) => target.create({
        ...args, data: { ...args.data, availableAt: new Date(Date.now() + 86_400_000) },
      });
      if (property === "findMany") return async () => [];
      if (property === "updateMany" || property === "deleteMany") return async () => ({ count: 0 });
      return Reflect.get(target, property);
    },
  });
  (globalThis as unknown as { prisma: PrismaClient }).prisma = new Proxy(client, {
    get(target, property) {
      return property === "notificationJob" ? queue : Reflect.get(target, property);
    },
  });
  const { POST } = await import("../app/api/mcp/route");
  const key = generateMcpKey();
  const owner = await client.user.create({ data: { email: `mcp-${randomUUID()}@example.test` } });
  const project = await client.project.create({ data: { ownerId: owner.id, name: "MCP workflow", slug: `mcp-${randomUUID()}`, mcpKeyHash: hashMcpKey(key) } });
  t.after(async () => {
    await client.notificationJob.deleteMany({ where: { payload: { path: ["project", "id"], equals: project.id } } });
    await client.project.delete({ where: { id: project.id } });
    await client.user.delete({ where: { id: owner.id } });
    await client.$disconnect();
  });
  await client.status.createMany({ data: [
    { projectId: project.id, name: "Open", order: 0 },
    { projectId: project.id, name: "In Progress", order: 1 },
    { projectId: project.id, name: "Building", order: 2 },
    { projectId: project.id, name: "Shipped", order: 3, isDone: true },
  ] });
  let requestId = 0;
  async function rpc(method: string, params = {}) {
    const response = await POST(new NextRequest("http://localhost/api/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.error, undefined);
    return body.result;
  }
  async function tool(name: string, args = {}) {
    const result = await rpc("tools/call", { name, arguments: args });
    assert.equal(result.isError, undefined, result.content[0].text);
    return JSON.parse(result.content[0].text);
  }
  const initialized = await rpc("initialize");
  assert.match(initialized.instructions, /Before starting implementation/);
  const tools = await rpc("tools/list");
  assert.ok(tools.tools.find((tool: { name: string; inputSchema: { properties: object } }) => tool.name === "update_feedback").inputSchema.properties.lifecycle_status);
  const { created } = await tool("create_feedback", { title: "Implement task" });
  const id = created.id;
  assert.equal(created.lifecycle_status, "OPEN");
  assert.equal((await tool("update_feedback", { id, status_name: "In Progress" })).updated.lifecycle_status, "IN_PROGRESS");
  assert.ok((await tool("list_feedback", { status: "IN_PROGRESS" })).items.some((item: { id: string }) => item.id === id));
  const active = (await tool("update_feedback", { id, status_name: "Building", lifecycle_status: "IN_PROGRESS" })).updated;
  assert.equal(active.board_column, "Building");
  assert.equal(active.lifecycle_status, "IN_PROGRESS");
  for (const args of [
    { id, lifecycle_status: "DONE" },
    { id, status_name: "Building", lifecycle_status: "DONE" },
    { id, status_name: "Shipped", lifecycle_status: "IN_PROGRESS" },
    { id, status_name: "Nonexistent" },
  ]) {
    assert.equal((await rpc("tools/call", { name: "update_feedback", arguments: args })).isError, true);
    assert.equal((await client.feedback.findUniqueOrThrow({ where: { id } })).status, "IN_PROGRESS");
  }
  const completed = (await tool("update_feedback", { id, status_name: "Shipped", lifecycle_status: "DONE" })).updated;
  assert.equal(completed.board_column, "Shipped");
  assert.equal(completed.lifecycle_status, "DONE");
  assert.equal(completed.done, true);
  assert.equal((await tool("list_feedback", { status: "IN_PROGRESS" })).count, 0);
  assert.equal((await tool("list_feedback", { status: "DONE" })).items[0].id, id);
  assert.equal((await tool("update_feedback", { id, status_name: "Open" })).updated.lifecycle_status, "OPEN");
  assert.equal(await client.notificationJob.count({ where: { payload: { path: ["project", "id"], equals: project.id } } }), 5);
});
