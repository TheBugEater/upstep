import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Prisma } from "@prisma/client";
import { processNotificationJobs } from "./notification-queue";

afterEach(() => mock.restoreAll());

test("a leftover fixture email fails permanently on its first attempt without contacting SendPanda", async () => {
  const originalKey = process.env.SENDPANDA_API_KEY;
  process.env.SENDPANDA_API_KEY = "test-only-key";
  let requests = 0;
  mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(null, { status: 202 });
  });
  const updates: Record<string, unknown>[] = [];
  const job = {
    id: "leftover-email", type: "EMAIL", status: "PENDING", attempts: 0,
    payload: { kind: "TASK_ACTIVITY", event: "COMMENT", toEmail: "collaboration-fixture@example.test",
      projectName: "Collaboration test", projectId: "project-test", taskId: "task-test", taskTitle: "Task", actorName: "Owner" },
  };
  const client = {
    notificationJob: {
      findMany: async () => [job], updateMany: async () => ({ count: 1 }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); return job; },
      deleteMany: async () => ({ count: 0 }),
    },
    rateLimitBucket: { deleteMany: async () => ({ count: 0 }) },
  } as unknown as Parameters<typeof processNotificationJobs>[1];
  try {
    const result = await processNotificationJobs(1, client);
    assert.equal(requests, 0);
    assert.equal(result.completed, 0);
    assert.equal(updates.at(-1)?.status, "FAILED");
    assert.match(String(updates.at(-1)?.lastError), /reserved test domain/);
    assert.equal(updates.at(-1)?.lockedAt, null);
    assert.ok(updates.some((data) => (data.payload as { idempotencyKey?: string } | undefined)?.idempotencyKey));
  } finally {
    if (originalKey === undefined) delete process.env.SENDPANDA_API_KEY;
    else process.env.SENDPANDA_API_KEY = originalKey;
  }
});

for (const [httpStatus, expectedStatus] of [[400, "FAILED"], [429, "PENDING"], [200, "COMPLETED"]] as const) {
  test(`Google Chat HTTP ${httpStatus} transitions the queued discussion to ${expectedStatus}`, async () => {
    const updates: Record<string, unknown>[] = [];
    const job = {
      id: "chat-discussion-test", type: "INTEGRATION", status: "PENDING", attempts: 0,
      payload: { event: "ISSUE_SHARED", integrationId: "chat-test", project: { id: "project-test", name: "Test" }, feedback: { id: "issue-test", title: "Issue", content: "Details", type: "BUG" } },
    };
    const client = {
      notificationJob: {
        findMany: async () => [job], updateMany: async () => ({ count: 1 }),
        update: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); return job; },
        deleteMany: async () => ({ count: 0 }),
      },
      project: { findUnique: async () => ({ owner: { plan: "PRO" }, integrations: [{ id: "chat-test", type: "GOOGLE_CHAT", webhookUrl: "https://chat.googleapis.com/v1/spaces/TEST/messages?key=test-key&token=test-token" }] }) },
      rateLimitBucket: { deleteMany: async () => ({ count: 0 }) },
      googleChatThread: { upsert: async (input: { create: { threadName: string } }) => { threads.push(input.create.threadName); return input; } },
    } as unknown as Pick<Prisma.TransactionClient, "notificationJob" | "project" | "rateLimitBucket" | "projectInvitation" | "googleChatThread">;
    const threads: string[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(new URL(String(input)).searchParams.has("requestId"), false);
      return Response.json(httpStatus === 200 ? { name: "spaces/TEST/messages/test", thread: { name: "spaces/TEST/threads/test" } } : { error: { message: "Provider rejection details" } }, { status: httpStatus });
    });
    const result = await processNotificationJobs(1, client);
    assert.equal(updates.at(-1)?.status, expectedStatus);
    assert.equal(result.completed, httpStatus === 200 ? 1 : 0);
    if (httpStatus !== 200) assert.match(String(updates.at(-1)?.lastError), /Provider rejection details/);
    else { assert.equal(updates.at(-1)?.lastError, null); assert.deepEqual(threads, ["spaces/TEST/threads/test"]); }
  });
}
