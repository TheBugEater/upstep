import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { getSupportProfile, saveSupportProfile, supportAuthorName, supportProfileSchema } from "./profile";
import { createSupportSession, startConversation, teamConversationAction } from "./service";

test("support names accept a separate customer-facing name and reject account-field injection", () => {
  assert.deepEqual(supportProfileSchema.parse({ supportDisplayName: "  Alex from Support  " }), { supportDisplayName: "Alex from Support" });
  for (const input of [{ supportDisplayName: "A\nB" }, { supportDisplayName: "x".repeat(81) }, { supportDisplayName: "Alex", userId: "another-user" }])
    assert.equal(supportProfileSchema.safeParse(input).success, false);
  assert.equal(supportAuthorName({ name: "GitHub handle", supportDisplayName: "Alex" }), "Alex");
  assert.equal(supportAuthorName({ name: "GitHub handle", supportDisplayName: null }), "GitHub handle");
  assert.equal(supportAuthorName({ name: null, supportDisplayName: null }, "Acme Team"), "Acme Team");
});

const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;
test("support profile changes affect only the teammate and future replies", { skip: !url }, async (t) => {
  const target = new URL(url!);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
  assert.ok(target.pathname.endsWith("_test") || target.pathname === "/build");
  const client = new PrismaClient({ datasourceUrl: url! });
  const tag = randomUUID();
  const owner = await client.user.create({ data: { email: `profile-${tag}@example.test`, name: "Account identity", plan: "PRO" } });
  const teammate = await client.user.create({ data: { email: `colleague-${tag}@example.test`, name: "Other identity" } });
  const project = await client.project.create({ data: { name: "Name test", slug: tag, ownerId: owner.id,
    members: { create: { userId: teammate.id, role: "MEMBER" } },
    supportConfig: { create: { enabled: true, businessName: "Acme", domain: "example.test", crawlState: "READY" } },
  } });
  t.after(async () => {
    await client.project.delete({ where: { id: project.id } });
    await client.user.deleteMany({ where: { id: { in: [owner.id, teammate.id] } } });
    await client.$disconnect();
  });
  await saveSupportProfile(teammate.id, { supportDisplayName: "Taylor" }, client);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: teammate.id } })).name, "Other identity");
  assert.equal((await getSupportProfile(owner.id, client)).supportDisplayName, "");
  const session = await createSupportSession(project.id, undefined, client);
  const conversation = await startConversation(project.id, session.customer.id, client);
  await teamConversationAction({ projectId: project.id, conversationId: conversation.id, actorId: teammate.id,
    action: "reply", content: "First reply", clientMessageId: randomUUID() }, client);
  await saveSupportProfile(teammate.id, { supportDisplayName: "" }, client);
  await teamConversationAction({ projectId: project.id, conversationId: conversation.id, actorId: teammate.id,
    action: "reply", content: "Second reply", clientMessageId: randomUUID() }, client);
  const replies = await client.supportMessage.findMany({ where: { conversationId: conversation.id, role: "AGENT" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(replies.map((m) => m.authorName), ["Taylor", "Other identity"]);
});
