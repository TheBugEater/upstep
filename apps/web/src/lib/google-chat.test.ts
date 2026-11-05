import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { googleChatMessage, googleChatWebhookUrl, googleChatRequestId, sendGoogleChat } from "./google-chat";
import { triggerIntegrations, type IntegrationPayload } from "./integrations";
import type { Prisma } from "@prisma/client";

const webhook = "https://chat.googleapis.com/v1/spaces/SPACE_TEST/messages?key=test-key&token=test-token";
const issueUrl = "https://upstep.dev/dashboard/projects/project-test?issue=issue-test";
const base = {
  project: { id: "project-test", name: "Our <project>" },
  feedback: { id: "issue-test", title: "Broken checkout", content: "Steps to reproduce", type: "BUG" },
};
const events: IntegrationPayload[] = [
  { ...base, event: "NEW_FEEDBACK" },
  { ...base, event: "STATUS_CHANGED", oldStatus: "OPEN", newStatus: "OPEN", oldStatusName: "To do", newStatusName: "Review" },
  { ...base, event: "NEW_COMMENT", comment: { content: "Investigating", authorName: "Sam" } },
  { ...base, event: "NEW_VOTE", feedback: { ...base.feedback, upvotes: 3, downvotes: 1 }, vote: { value: "UP" } },
];

beforeEach(() => {
  // Never contact a real Chat space in tests.
  mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network request"); });
});
afterEach(() => mock.restoreAll());

test("accepts only credential-bearing Google Chat webhook URLs", () => {
  assert.equal(googleChatWebhookUrl(webhook).origin, "https://chat.googleapis.com");
  const clean = googleChatWebhookUrl(webhook + "&threadKey=wrong&requestId=wrong");
  assert.equal(clean.searchParams.get("threadKey"), null);
  assert.equal(clean.searchParams.get("requestId"), null);
  for (const bad of [
    "not-a-url", webhook.replace("https:", "http:"), webhook.replace("chat.googleapis.com", "chat.googleapis.com.evil.test"),
    webhook.replace("chat.googleapis.com", "localhost"), webhook.replace("chat.googleapis.com", "user@chat.googleapis.com"),
    webhook.replace("/messages", "/members"), webhook.replace("test-token", ""), webhook.replace("test-key", ""),
    webhook.replace("chat.googleapis.com", "chat.googleapis.com:8443"), webhook + "#fragment",
  ]) assert.throws(() => googleChatWebhookUrl(bad), /Google Chat webhook URL/);
});

test("all issue events share one thread and link directly to the issue", () => {
  for (const event of events) {
    const message = googleChatMessage(event, issueUrl);
    assert.equal(message.thread.threadKey, "upstep:project-test:issue-test");
    assert.ok(JSON.stringify(message).includes(issueUrl));
    assert.ok(Buffer.byteLength(JSON.stringify(message)) < 32_000);
  }
  assert.notEqual(googleChatMessage({ ...base, event: "NEW_FEEDBACK", feedback: { ...base.feedback, id: "another-issue" } }, issueUrl).thread.threadKey,
    googleChatMessage(events[0]!, issueUrl).thread.threadKey);
  assert.notEqual(googleChatMessage({ ...base, event: "NEW_FEEDBACK", project: { ...base.project, id: "another-project" } }, issueUrl).thread.threadKey,
    googleChatMessage(events[0]!, issueUrl).thread.threadKey);
  const status = JSON.stringify(googleChatMessage(events[1]!, issueUrl));
  assert.ok(status.includes("To do → Review"));
});

test("escapes issue and comment content, preserves author names, and bounds message size", () => {
  const event: IntegrationPayload = {
    ...base, event: "NEW_COMMENT",
    feedback: { ...base.feedback, title: "<users/all> & bug", content: '<a href="https://evil.test">'.repeat(1_000) },
    comment: { content: "<users/all> & <script>".repeat(1_000), authorName: "Jane & Sam" },
  };
  const body = JSON.stringify(googleChatMessage(event, issueUrl));
  assert.ok(body.includes("&lt;users/all&gt; &amp; bug"));
  assert.ok(body.includes("Jane &amp; Sam"));
  assert.ok(!body.includes("<users/all>"));
  assert.ok(!body.includes("<script>"));
  assert.ok(Buffer.byteLength(body) < 32_000);
  event.comment.authorName = " ";
  assert.ok(JSON.stringify(googleChatMessage(event, issueUrl)).includes("UpStep Team"));
});

test("sends threaded messages with the same request ID on retries", async () => {
  let attempts = 0;
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("messageReplyOption"), "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
    assert.equal(url.searchParams.get("requestId"), "job-test-integration-test");
    assert.equal(url.searchParams.get("key"), "test-key");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(init?.body as string), googleChatMessage(events[0]!, issueUrl));
    return new Response(null, { status: ++attempts === 1 ? 429 : 200 });
  });
  await assert.rejects(sendGoogleChat(webhook, events[0]!, issueUrl, "job-test-integration-test"), /HTTP 429/);
  await sendGoogleChat(webhook, events[0]!, issueUrl, "job-test-integration-test");
  assert.equal(attempts, 2);
});

test("transport errors cannot expose webhook credentials to queue logs", async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error(`Failed to fetch ${webhook}`); });
  await assert.rejects(sendGoogleChat(webhook, events[0]!, issueUrl), { message: "Google Chat request failed or timed out." });
});

test("integration dispatch uses a stable request ID per destination and respects the plan gate", async () => {
  let plan = "PRO";
  const client = { project: { findUnique: async (input: unknown) => {
    assert.deepEqual(input, {
      where: { id: base.project.id },
      select: { owner: { select: { plan: true } }, integrations: { where: { enabled: true, events: { has: "NEW_FEEDBACK" } } } },
    });
    return { owner: { plan }, integrations: [
      { id: "chat-one", type: "GOOGLE_CHAT", webhookUrl: webhook },
      { id: "chat-two", type: "GOOGLE_CHAT", webhookUrl: webhook },
    ] } as never;
  } } } as unknown as Pick<Prisma.TransactionClient, "project">;
  const ids: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    ids.push(new URL(String(input)).searchParams.get("requestId")!);
    assert.ok(JSON.stringify(JSON.parse(init?.body as string)).includes("/api/projects/project-test/feedback/issue-test/open"));
    return new Response(null, { status: 200 });
  });
  await triggerIntegrations(events[0]!, "job-test", client);
  await triggerIntegrations(events[0]!, "job-test", client);
  assert.deepEqual(ids, [googleChatRequestId("job-test", "chat-one"), googleChatRequestId("job-test", "chat-two"), googleChatRequestId("job-test", "chat-one"), googleChatRequestId("job-test", "chat-two")]);
  assert.notEqual(ids[0], ids[1]);
  assert.match(ids[0]!, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  plan = "FREE";
  await triggerIntegrations(events[0]!, "job-other", client);
  assert.equal(ids.length, 4);
});
