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
  const additionalUsers: string[] = [];
  const additionalProjects: string[] = [];
  t.after(async () => {
    await client.notificationJob.deleteMany({ where: { payload: { path: ["project", "id"], equals: project.id } } });
    await client.project.delete({ where: { id: project.id } });
    await client.project.deleteMany({ where: { id: { in: additionalProjects } } });
    await client.user.deleteMany({ where: { id: { in: additionalUsers } } });
    await client.user.delete({ where: { id: owner.id } });
    await client.$disconnect();
  });
  await client.status.createMany({ data: [
    { projectId: project.id, name: "Open", order: 0 },
    { projectId: project.id, name: "In Progress", order: 1, color: "#3b82f6" },
    { projectId: project.id, name: "Building", order: 2, color: "#a855f7" },
    { projectId: project.id, name: "Shipped", order: 3, color: "#22c55e", isDone: true },
  ] });
  let requestId = 0;
  async function request(method: string, params = {}, credential = key) {
    return POST(new NextRequest("http://localhost/api/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    }));
  }
  async function rpc(method: string, params = {}, credential = key) {
    const response = await request(method, params, credential);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.error, undefined);
    return body.result;
  }
  async function tool(name: string, args = {}, credential = key) {
    const result = await rpc("tools/call", { name, arguments: args }, credential);
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
  const completionJob = await client.notificationJob.findFirstOrThrow({ where: { AND: [
    { payload: { path: ["project", "id"], equals: project.id } },
    { payload: { path: ["newStatusName"], equals: "Shipped" } },
  ] } });
  assert.equal((completionJob.payload as { oldStatusColor: string }).oldStatusColor, "#a855f7");
  assert.equal((completionJob.payload as { newStatusColor: string }).newStatusColor, "#22c55e");
  assert.equal((await tool("list_feedback", { status: "IN_PROGRESS" })).count, 0);
  assert.equal((await tool("list_feedback", { status: "DONE" })).items[0].id, id);
  const completionNote = "Completed: fixed the task status mapping. Validation: lifecycle tests passed. Commit: abc1234 (test fixture).";
  const comment = await tool("add_comment", { feedback_id: id, content: completionNote });
  assert.equal(comment.posted, true);
  const savedComment = await client.comment.findUniqueOrThrow({ where: { id: comment.comment_id } });
  assert.equal(savedComment.feedbackId, id);
  assert.equal(savedComment.content, completionNote);
  assert.equal(savedComment.authorName, "UpStep Team");
  assert.ok((await tool("get_feedback", { id })).comments.some((item: { content: string }) => item.content === completionNote));
  const notification = await client.notificationJob.findFirstOrThrow({ where: { payload: { path: ["comment", "content"], equals: completionNote } } });
  assert.equal((notification.payload as { event: string }).event, "NEW_COMMENT");
  assert.equal((await tool("update_feedback", { id, status_name: "Open" })).updated.lifecycle_status, "OPEN");
  assert.equal(await client.notificationJob.count({ where: { payload: { path: ["project", "id"], equals: project.id } } }), 6);

  const { authenticateMcpKey, issuePersonalMcpKey, revokePersonalMcpKey, revokeLegacyMcpKey, personalMcpSummary } = await import("./mcp-access");
  const { changeMemberRole, removeProjectMember } = await import("./project-collaboration");
  const [alice, bob, admin, outsider] = await Promise.all(["Alice", "Bob", "Admin", "Outsider"].map((name) => client.user.create({ data: { name, email: `mcp-${randomUUID()}@example.test` } })));
  additionalUsers.push(alice!.id, bob!.id, admin!.id, outsider!.id);
  await client.projectMember.createMany({ data: [
    { projectId: project.id, userId: alice!.id }, { projectId: project.id, userId: bob!.id },
    { projectId: project.id, userId: admin!.id, role: "ADMIN" },
  ] });
  const [aliceCredential, bobCredential] = await Promise.all([
    issuePersonalMcpKey(project.id, alice!.id, client), issuePersonalMcpKey(project.id, bob!.id, client),
  ]);
  let aliceKey = aliceCredential.mcpKey;
  let bobKey = bobCredential.mcpKey;

  await t.test("teammates have independent keys, safe summaries, and project-scoped identity", async () => {
    assert.notEqual(aliceKey, bobKey);
    const stored = await client.mcpCredential.findUniqueOrThrow({ where: { projectId_userId: { projectId: project.id, userId: alice!.id } } });
    assert.equal(stored.keyHash, hashMcpKey(aliceKey));
    assert.notEqual(stored.keyHash, aliceKey);
    const overview = await tool("get_project_overview", {}, aliceKey);
    assert.equal(overview.current_user.id, alice!.id);
    assert.equal(overview.current_user.name, "Alice");
    assert.ok(overview.team_members.some((member: { id: string }) => member.id === bob!.id));
    assert.match((await rpc("initialize", {}, aliceKey)).instructions, /Authenticated teammate:/);
    const mine = await personalMcpSummary(project.id, alice!.id, client);
    assert.equal(mine.configured, true);
    assert.deepEqual(mine.keys, []);
    const team = await personalMcpSummary(project.id, owner.id, client);
    assert.equal(team.keys.length, 2);
    assert.ok(!JSON.stringify(team).includes(aliceKey));
    assert.ok(!JSON.stringify(team).includes(stored.keyHash!));
    await assert.rejects(issuePersonalMcpKey(project.id, outsider!.id, client));
    await assert.rejects(personalMcpSummary(project.id, outsider!.id, client));
  });

  await t.test("parallel users get their own task lists and authenticated comment authors", async () => {
    const [aliceTask, bobTask] = await Promise.all([
      tool("create_feedback", { title: "Alice work" }, aliceKey), tool("create_feedback", { title: "Bob work" }, bobKey),
    ]);
    assert.equal(aliceTask.created.assignee_id, alice!.id);
    assert.equal(bobTask.created.assignee_id, bob!.id);
    const mine = await tool("list_feedback", {}, aliceKey);
    assert.ok(mine.items.some((item: { id: string }) => item.id === aliceTask.created.id));
    assert.ok(!mine.items.some((item: { id: string }) => item.id === bobTask.created.id));
    const all = await tool("list_feedback", { assignee_id: "all" }, aliceKey);
    assert.ok(all.items.some((item: { id: string }) => item.id === bobTask.created.id));
    assert.ok((await tool("list_feedback", { assignee_id: null }, aliceKey)).items.some((item: { id: string }) => item.id === id));
    const named = await tool("add_comment", { feedback_id: aliceTask.created.id, content: "Finished as Alice", author_name: "Forged Owner" }, aliceKey);
    const saved = await client.comment.findUniqueOrThrow({ where: { id: named.comment_id } });
    assert.equal(saved.authorId, alice!.id);
    assert.equal(saved.authorName, "Alice");
    assert.equal(saved.isOwner, false);
    const comments = (await tool("get_feedback", { id: aliceTask.created.id }, bobKey)).comments;
    assert.equal(comments[0].author_id, alice!.id);
    assert.equal(comments[0].from_team, true);
    assert.equal((await tool("update_feedback", { id, assignee_id: "me" }, aliceKey)).updated.assignee_id, alice!.id);
    const invalid = await rpc("tools/call", { name: "update_feedback", arguments: { id, assignee_id: outsider!.id } }, aliceKey);
    assert.equal(invalid.isError, true);
    assert.equal((await client.feedback.findUniqueOrThrow({ where: { id } })).assigneeId, alice!.id);
    const buckets = await client.rateLimitBucket.findMany({ where: { OR: [
      { key: { startsWith: `mcp:user:${project.id}:${alice!.id}:` } }, { key: { startsWith: `mcp:user:${project.id}:${bob!.id}:` } },
    ] } });
    assert.ok(buckets.some((bucket) => bucket.key.includes(alice!.id)));
    assert.ok(buckets.some((bucket) => bucket.key.includes(bob!.id)));
  });

  await t.test("keys stay in one project and personal rotation leaves other users and projects connected", async () => {
    const other = await client.project.create({ data: { ownerId: owner.id, name: "Other MCP project", slug: `mcp-${randomUUID()}` } });
    additionalProjects.push(other.id);
    await client.projectMember.create({ data: { projectId: other.id, userId: alice!.id } });
    const otherKey = (await issuePersonalMcpKey(other.id, alice!.id, client)).mcpKey;
    assert.equal((await tool("get_project_overview", {}, otherKey)).project, other.name);
    assert.equal((await rpc("tools/call", { name: "get_feedback", arguments: { id } }, otherKey)).isError, true);
    const oldKey = aliceKey;
    aliceKey = (await issuePersonalMcpKey(project.id, alice!.id, client)).mcpKey;
    assert.equal((await request("ping", {}, oldKey)).status, 401);
    assert.equal((await request("ping", {}, bobKey)).status, 200);
    assert.equal((await request("ping", {}, otherKey)).status, 200);
    assert.equal((await request("ping")).status, 200);
    assert.equal(await authenticateMcpKey("upstep_pk_public-key", client), null);
  });

  await t.test("personal tools follow current roles and only owners revoke other users' keys", async () => {
    assert.equal((await rpc("tools/list", {}, aliceKey)).tools.some((tool: { name: string }) => tool.name === "create_board"), false);
    assert.equal((await rpc("tools/call", { name: "create_board", arguments: { name: "Forbidden", columns: ["Open"] } }, aliceKey)).isError, true);
    const adminKey = (await issuePersonalMcpKey(project.id, admin!.id, client)).mcpKey;
    assert.ok((await tool("create_board", { name: "Admin workspace", columns: ["Open", "Shipped"] }, adminKey)).created_board);
    await changeMemberRole({ projectId: project.id, actorId: owner.id, userId: admin!.id, role: "MEMBER" }, client);
    assert.equal((await rpc("tools/call", { name: "create_board", arguments: { name: "After demotion", columns: ["Open"] } }, adminKey)).isError, true);
    await assert.rejects(revokePersonalMcpKey(project.id, alice!.id, bob!.id, client));
    await assert.rejects(revokePersonalMcpKey(project.id, admin!.id, bob!.id, client));
    await revokePersonalMcpKey(project.id, owner.id, bob!.id, client);
    assert.equal((await request("ping", {}, bobKey)).status, 401);
    assert.equal((await request("ping", {}, aliceKey)).status, 200);
    bobKey = (await issuePersonalMcpKey(project.id, bob!.id, client)).mcpKey;
  });

  await t.test("removal revokes access permanently, including after a later invitation", async () => {
    await removeProjectMember({ projectId: project.id, actorId: owner.id, userId: bob!.id }, client);
    assert.equal((await request("ping", {}, bobKey)).status, 401);
    await assert.rejects(issuePersonalMcpKey(project.id, bob!.id, client));
    await client.projectMember.create({ data: { projectId: project.id, userId: bob!.id } });
    assert.equal((await request("ping", {}, bobKey)).status, 401);
    assert.equal((await request("ping", {}, (await issuePersonalMcpKey(project.id, bob!.id, client)).mcpKey)).status, 200);
    await revokePersonalMcpKey(project.id, alice!.id, alice!.id, client);
    assert.equal((await request("ping", {}, aliceKey)).status, 401);
  });

  await t.test("legacy shared access remains explicit and only the owner can retire it", async () => {
    const overview = await tool("get_project_overview");
    assert.equal(overview.credential_type, "legacy_shared");
    assert.equal(overview.current_user, null);
    await assert.rejects(revokeLegacyMcpKey(project.id, admin!.id, client));
    await revokeLegacyMcpKey(project.id, owner.id, client);
    assert.equal((await request("ping")).status, 401);
    assert.equal((await request("ping", {}, (await issuePersonalMcpKey(project.id, owner.id, client)).mcpKey)).status, 200);
  });
});
