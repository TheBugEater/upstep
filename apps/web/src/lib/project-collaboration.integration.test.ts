import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { changeMemberRole, removeProjectMember, collaborationTransaction, CollaborationError } from "./project-collaboration";
import { assertProjectAssignee } from "./task-assignment";
import { getProjectAccess } from "./project-auth";
import { addTaskComment } from "./task-comments";
import { discussionJobId, startGoogleChatDiscussion } from "./google-chat-discussions";
import { triggerIntegrations, type IntegrationPayload } from "./integrations";
import { googleChatMessage, googleChatRequestId } from "./google-chat";

const databaseUrl = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;
test("project task collaboration permissions and lifecycle", { skip: !databaseUrl }, async (t) => {
  const url = new URL(databaseUrl!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.ok(url.pathname.endsWith("_test") || url.pathname === "/build");
  const client = new PrismaClient({ datasourceUrl: databaseUrl! });
  const users = await Promise.all(["Owner", "Admin", "Member", "Outsider"].map((name) => client.user.create({ data: { name, email: `collaboration-${randomUUID()}@example.test` } })));
  const [owner, admin, member, outsider] = users as [typeof users[number], typeof users[number], typeof users[number], typeof users[number]];
  const project = await client.project.create({ data: { ownerId: owner.id, name: "Collaboration test", slug: `collaboration-${randomUUID()}` } });
  await client.projectMember.createMany({ data: [{ projectId: project.id, userId: admin.id, role: "ADMIN" }, { projectId: project.id, userId: member.id }] });
  const task = await client.feedback.create({ data: { projectId: project.id, title: "Task", content: "Discussion" } });
  const otherTask = await client.feedback.create({ data: { projectId: project.id, content: "Another task" } });
  t.after(async () => {
    // Only these isolated fixtures are removed, never any pre-existing records.
    await client.notificationJob.deleteMany({ where: { payload: { path: ["project", "id"], equals: project.id } } });
    await client.project.delete({ where: { id: project.id } });
    await client.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await client.$disconnect();
  });
  const assign = (userId: string | null) => collaborationTransaction(async (tx) => {
    await assertProjectAssignee(project.id, userId, tx);
    return tx.feedback.update({ where: { id: task.id }, data: { assigneeId: userId } });
  }, client);

  await t.test("owner and admin can manage, while members keep task access only", async () => {
    assert.equal((await getProjectAccess(project.id, owner.id, client))?.role, "OWNER");
    assert.equal((await getProjectAccess(project.id, admin.id, client))?.canManage, true);
    assert.equal((await getProjectAccess(project.id, member.id, client))?.canManage, false);
    assert.equal(await getProjectAccess(project.id, outsider.id, client), null);
  });

  await t.test("only the owner can promote or demote, and cannot modify the owner", async () => {
    for (const actor of [admin, member, outsider]) {
      await assert.rejects(changeMemberRole({ projectId: project.id, actorId: actor.id, userId: member.id, role: "ADMIN" }, client), (e) => e instanceof CollaborationError && e.status === 403);
    }
    await changeMemberRole({ projectId: project.id, actorId: owner.id, userId: member.id, role: "ADMIN" }, client);
    assert.equal((await getProjectAccess(project.id, member.id, client))?.canManage, true);
    await changeMemberRole({ projectId: project.id, actorId: owner.id, userId: member.id, role: "MEMBER" }, client);
    assert.equal((await getProjectAccess(project.id, member.id, client))?.canManage, false);
    await assert.rejects(changeMemberRole({ projectId: project.id, actorId: owner.id, userId: owner.id, role: "MEMBER" }, client));
    await assert.rejects(changeMemberRole({ projectId: project.id, actorId: owner.id, userId: outsider.id, role: "ADMIN" }, client));
  });

  await t.test("assignment accepts current teammates and rejects outsiders", async () => {
    assert.equal((await assign(owner.id)).assigneeId, owner.id);
    assert.equal((await assign(member.id)).assigneeId, member.id);
    await assert.rejects(assign(outsider.id), (e) => e instanceof CollaborationError && e.status === 400);
    assert.equal((await client.feedback.findUniqueOrThrow({ where: { id: task.id } })).assigneeId, member.id);
    assert.equal((await assign(null)).assigneeId, null);
  });

  await t.test("comments retain authenticated authors, reply context and atomic notification jobs", async () => {
    const first = await addTaskComment({ projectId: project.id, feedbackId: task.id, actorId: owner.id, content: "First comment" }, client);
    const reply = await addTaskComment({ projectId: project.id, feedbackId: task.id, actorId: member.id, content: "  Investigating\nnow  ", parentId: first.id }, client);
    assert.equal(first.authorId, owner.id);
    assert.equal(first.isOwner, true);
    assert.equal(reply.authorName, "Member");
    assert.equal(reply.author?.id, member.id);
    assert.equal(reply.isOwner, false);
    assert.equal(reply.parentId, first.id);
    assert.equal(reply.content, "Investigating\nnow");
    assert.equal(await client.notificationJob.count({ where: { payload: { path: ["project", "id"], equals: project.id } } }), 2);
    await assert.rejects(addTaskComment({ projectId: project.id, feedbackId: otherTask.id, actorId: member.id, content: "Wrong thread", parentId: first.id }, client));
    await assert.rejects(addTaskComment({ projectId: project.id, feedbackId: task.id, actorId: outsider.id, content: "No access" }, client));
    await assert.rejects(addTaskComment({ projectId: project.id, feedbackId: task.id, actorId: member.id, content: "  " }, client));
    assert.equal(await client.comment.count({ where: { feedbackId: otherTask.id } }), 0);
  });

  await t.test("member removal unassigns their work and prevents later assignments or comments", async () => {
    await assign(member.id);
    await assert.rejects(removeProjectMember({ projectId: project.id, actorId: member.id, userId: admin.id }, client));
    await assert.rejects(removeProjectMember({ projectId: project.id, actorId: admin.id, userId: owner.id }, client));
    await removeProjectMember({ projectId: project.id, actorId: admin.id, userId: member.id }, client);
    assert.equal((await client.feedback.findUniqueOrThrow({ where: { id: task.id } })).assigneeId, null);
    assert.equal(await getProjectAccess(project.id, member.id, client), null);
    await assert.rejects(assign(member.id));
    await assert.rejects(addTaskComment({ projectId: project.id, feedbackId: task.id, actorId: member.id, content: "Removed" }, client));
    assert.equal(await client.comment.count({ where: { feedbackId: task.id, authorId: member.id } }), 1);
  });

  await t.test("existing tasks can start a Google Chat discussion once, independently of automatic event subscriptions", async () => {
    await client.user.update({ where: { id: owner.id }, data: { plan: "PRO" } });
    const chat = await client.integration.create({ data: { projectId: project.id, type: "GOOGLE_CHAT", name: "Product team", webhookUrl: "https://chat.googleapis.com/v1/spaces/TEST_SPACE/messages?key=test-key&token=test-token", events: ["STATUS_CHANGED"] } });
    const input = { projectId: project.id, feedbackId: task.id, integrationId: chat.id, actorId: admin.id };
    await assert.rejects(startGoogleChatDiscussion({ ...input, actorId: outsider.id }, client));
    const before = await startGoogleChatDiscussion(input, client);
    await Promise.all([startGoogleChatDiscussion(input, client), startGoogleChatDiscussion(input, client)]);
    const id = discussionJobId(chat.id, task.id);
    assert.equal(await client.notificationJob.count({ where: { id } }), 1);
    assert.ok(["PENDING", "PROCESSING", "COMPLETED"].includes(before.status));
    const job = await client.notificationJob.findUniqueOrThrow({ where: { id } });
    const payload = job.payload as unknown as IntegrationPayload;
    assert.equal(payload.event, "ISSUE_SHARED");
    const requests: string[] = [];
    const stub = mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new URL(String(url)).searchParams.get("requestId")!);
      const body = JSON.parse(init?.body as string);
      assert.equal(body.thread.threadKey, `upstep:${project.id}:${task.id}`);
      return new Response(null, { status: 200 });
    });
    try {
      await triggerIntegrations(payload, job.id, client);
      await triggerIntegrations(payload, job.id, client);
      assert.deepEqual(requests, [googleChatRequestId(id, chat.id), googleChatRequestId(id, chat.id)]);
      assert.equal(googleChatMessage({ event: "NEW_FEEDBACK", project: { id: project.id, name: project.name }, feedback: { id: task.id, title: task.title, content: task.content, type: task.type } }, "https://upstep.dev").thread.threadKey,
        googleChatMessage(payload, "https://upstep.dev").thread.threadKey);
      await client.integration.update({ where: { id: chat.id }, data: { enabled: false } });
      await assert.rejects(startGoogleChatDiscussion(input, client));
      await assert.rejects(triggerIntegrations(payload, job.id, client));
      assert.equal(requests.length, 2);
    } finally { stub.mock.restore(); }
  });
});
