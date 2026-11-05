import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import type { Prisma } from "@prisma/client";
import { processNotificationJobs } from "./notification-queue";

afterEach(() => mock.restoreAll());

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
    } as unknown as Pick<Prisma.TransactionClient, "notificationJob" | "project" | "rateLimitBucket" | "projectInvitation">;
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
      assert.equal(new URL(String(input)).searchParams.has("requestId"), false);
      return Response.json(httpStatus === 200 ? { name: "spaces/TEST/messages/test" } : { error: { message: "Provider rejection details" } }, { status: httpStatus });
    });
    const result = await processNotificationJobs(1, client);
    assert.equal(updates.at(-1)?.status, expectedStatus);
    assert.equal(result.completed, httpStatus === 200 ? 1 : 0);
    if (httpStatus !== 200) assert.match(String(updates.at(-1)?.lastError), /Provider rejection details/);
    else assert.equal(updates.at(-1)?.lastError, null);
  });
}
