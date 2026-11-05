import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { googleChatMessage, googleChatWebhookUrl, GoogleChatDeliveryError, sendGoogleChat } from "./google-chat";
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
  { ...base, event: "ISSUE_SHARED", integrationId: "chat-test" },
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
    assert.equal(message.text, "Broken checkout");
    assert.equal(message.cardsV2[0]!.card.header.title, "Broken checkout");
    assert.equal(message.thread.threadKey, "upstep:project-test:issue-test");
    assert.ok(JSON.stringify(message).includes(issueUrl));
    assert.ok(Buffer.byteLength(JSON.stringify(message)) < 32_000);
  }
  assert.notEqual(googleChatMessage({ ...base, event: "NEW_FEEDBACK", feedback: { ...base.feedback, id: "another-issue" } }, issueUrl).thread.threadKey,
    googleChatMessage(events[0]!, issueUrl).thread.threadKey);
  assert.notEqual(googleChatMessage({ ...base, event: "NEW_FEEDBACK", project: { ...base.project, id: "another-project" } }, issueUrl).thread.threadKey,
    googleChatMessage(events[0]!, issueUrl).thread.threadKey);
  const status = JSON.stringify(googleChatMessage(events[1]!, issueUrl));
  assert.ok(status.includes("To do</b> →"));
  assert.ok(status.includes("Review</b>"));
});

test("cards use actual status and label colors, show assignees, and tint the action", () => {
  const message = googleChatMessage({
    ...base, event: "ISSUE_SHARED", integrationId: "chat-test",
    feedback: { ...base.feedback, status: "IN_PROGRESS", internal: true,
      boardStatus: { name: "Review & QA", color: "#a855f7", isDone: false },
      labels: [{ name: "Billing <urgent>", color: "#ef4444" }, { name: "Mobile", color: "#06b6d4" }],
      assignee: { name: "Jane Smith" },
    },
  }, issueUrl);
  const body = JSON.stringify(message);
  assert.ok(body.includes('color=\\"#a855f7\\"'));
  assert.ok(body.includes('color=\\"#ef4444\\"'));
  assert.ok(body.includes('color=\\"#06b6d4\\"'));
  assert.ok(body.includes("Review &amp; QA"));
  assert.ok(body.includes("Billing &lt;urgent&gt;"));
  assert.ok(body.includes("Assigned to Jane Smith"));
  assert.ok(body.includes("Internal task"));
  const action = message.cardsV2[0]!.card.sections.at(-1)!.widgets[0]!;
  assert.ok("buttonList" in action);
  assert.deepEqual(action.buttonList.buttons[0]!.color, { red: 168 / 255, green: 85 / 255, blue: 247 / 255 });
});

test("all event cards keep the same three compact widgets visible and hide details by default", () => {
  for (const event of events) {
    const card = googleChatMessage(event, issueUrl).cardsV2[0]!.card;
    const section = card.sections[0]!;
    assert.equal(section.collapsible, true);
    assert.equal(section.uncollapsibleWidgetsCount, 3);
    assert.equal(section.collapseControl?.expandButton.text, "Show details");
    assert.equal(section.collapseControl?.collapseButton.text, "Hide details");
    const visible = section.widgets.slice(0, section.uncollapsibleWidgetsCount);
    assert.ok("columns" in visible[0]!);
    for (const column of visible[0].columns.columnItems) {
      assert.equal(column.widgets[0]!.decoratedText.wrapText, false);
      assert.ok(!column.widgets[0]!.decoratedText.text.includes("<br>"));
    }
    for (const widget of visible.slice(1)) {
      assert.ok("decoratedText" in widget);
      assert.equal(widget.decoratedText.wrapText, false);
      assert.ok(!widget.decoratedText.text.includes("<br>"));
    }
    assert.ok(section.widgets.length > section.uncollapsibleWidgetsCount);
    assert.equal(card.sections.length, 2);
    assert.ok("buttonList" in card.sections[1]!.widgets[0]!);
  }
});

test("long comments keep their final commit evidence in hidden details instead of growing the summary", () => {
  const content = "Completion note\n".repeat(110).slice(0, 1900) + "\nCommit: abc1234";
  const message = googleChatMessage({ ...base, event: "NEW_COMMENT", comment: { authorName: "Sam\nPatel", content } }, issueUrl);
  const section = message.cardsV2[0]!.card.sections[0]!;
  const visible = JSON.stringify(section.widgets.slice(0, section.uncollapsibleWidgetsCount));
  const hidden = JSON.stringify(section.widgets.slice(section.uncollapsibleWidgetsCount));
  assert.ok(!visible.includes("Commit: abc1234"));
  assert.ok(hidden.includes("Commit: abc1234"));
  assert.ok(visible.includes("Comment · Sam Patel"));
  assert.ok(!visible.includes("<br>"));
  assert.ok(Buffer.byteLength(JSON.stringify(message)) < 32_000);
});

test("status replies retain both event colors and comments focus on the named author's update", () => {
  const status = JSON.stringify(googleChatMessage({ ...base, event: "STATUS_CHANGED", oldStatus: "OPEN", newStatus: "DONE", oldStatusName: "Review", newStatusName: "Shipped", oldStatusColor: "#a855f7", newStatusColor: "#22c55e" }, issueUrl));
  assert.ok(status.includes('color=\\"#a855f7\\"'));
  assert.ok(status.includes('color=\\"#22c55e\\"'));
  assert.ok(status.includes("Review</b> →"));
  assert.ok(status.includes("Shipped</b>"));
  assert.ok(!status.includes(base.feedback.content));
  const comment = JSON.stringify(googleChatMessage(events[2]!, issueUrl));
  assert.ok(comment.includes("Sam"));
  assert.ok(comment.includes("Investigating"));
  assert.ok(!comment.includes(base.feedback.content));
});

test("legacy jobs, pending moderation, malformed colors, and excessive labels render safely", () => {
  const legacy = JSON.stringify(googleChatMessage(events[0]!, issueUrl));
  assert.ok(legacy.includes("Open</b>"));
  assert.ok(legacy.includes("Unassigned"));
  const pending = JSON.stringify(googleChatMessage({ ...base, event: "NEW_FEEDBACK", feedback: { ...base.feedback, status: "PENDING", boardStatus: { name: "Open", color: "#000000", isDone: false } } }, issueUrl));
  assert.ok(pending.includes("Pending review</b>"));
  assert.ok(pending.includes('color=\\"#f59e0b\\"'));
  const maliciousColor = '#fff\" onmouseover=\"bad';
  const bounded = JSON.stringify(googleChatMessage({ ...base, event: "NEW_FEEDBACK", feedback: {
    ...base.feedback, boardStatus: { name: "Safe", color: maliciousColor, isDone: false },
    labels: Array.from({ length: 100 }, (_, i) => ({ name: `<Label ${i}>`.repeat(100), color: maliciousColor })),
    assignee: { name: null },
  } }, issueUrl));
  assert.ok(!bounded.includes("onmouseover"));
  assert.ok(bounded.includes("+92 more"));
  assert.ok(bounded.includes("Assigned to Teammate"));
  assert.ok(Buffer.byteLength(bounded) < 32_000);
});

test("escapes issue and comment content, preserves author names, and bounds message size", () => {
  const event: IntegrationPayload = {
    ...base, event: "NEW_COMMENT",
    feedback: { ...base.feedback, title: "<users/all> & bug", content: '<a href="https://evil.test">'.repeat(1_000) },
    comment: { content: "<users/all> & <script>".repeat(1_000), authorName: "Jane & Sam" },
  };
  const body = JSON.stringify(googleChatMessage(event, issueUrl));
  assert.ok(body.includes("‹users/all› & bug"));
  assert.ok(body.includes("Jane &amp; Sam"));
  assert.ok(!body.includes("<users/all>"));
  assert.ok(!body.includes("<script>"));
  assert.ok(Buffer.byteLength(body) < 32_000);
  event.comment.authorName = " ";
  assert.ok(JSON.stringify(googleChatMessage(event, issueUrl)).includes("UpStep Team"));
});

test("sends threaded webhook messages without the unsupported requestId parameter", async () => {
  let attempts = 0;
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("messageReplyOption"), "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
    assert.equal(url.searchParams.get("requestId"), null);
    assert.equal(url.searchParams.get("key"), "test-key");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(init?.body as string), googleChatMessage(events[0]!, issueUrl));
    return new Response(null, { status: ++attempts === 1 ? 429 : 200 });
  });
  await assert.rejects(sendGoogleChat(webhook + "&requestId=reject-this", events[0]!, issueUrl), /HTTP 429/);
  await sendGoogleChat(webhook + "&requestId=reject-this", events[0]!, issueUrl);
  assert.equal(attempts, 2);
});

test("transport errors cannot expose webhook credentials to queue logs", async () => {
  mock.method(globalThis, "fetch", async () => { throw new Error(`Failed to fetch ${webhook}`); });
  await assert.rejects(sendGoogleChat(webhook, events[0]!, issueUrl), { message: "Google Chat request failed or timed out." });
});

test("permanent webhook rejections retain Google's explanation and redact credentials", async () => {
  mock.method(globalThis, "fetch", async () => Response.json({ error: { message: `Request Id is not supported for webhooks. key=test-key token=test-token ${webhook}` } }, { status: 400 }));
  await assert.rejects(sendGoogleChat(webhook, events[0]!, issueUrl), (error) => {
    assert.ok(error instanceof GoogleChatDeliveryError);
    assert.equal(error.retryable, false);
    assert.match(error.message, /Request Id is not supported for webhooks/);
    assert.ok(!error.message.includes("test-key"));
    assert.ok(!error.message.includes("test-token"));
    assert.ok(!error.message.includes("https://"));
    return true;
  });
});

test("rate limits and server failures remain retryable, while authorization failures stop", async () => {
  for (const status of [400, 401, 403, 404, 408, 429, 500, 503]) {
    mock.method(globalThis, "fetch", async () => new Response("not JSON", { status }));
    await assert.rejects(sendGoogleChat(webhook, events[0]!, issueUrl), (error) => error instanceof GoogleChatDeliveryError && error.retryable === [408, 429, 500, 503].includes(status));
  }
});

test("integration dispatch only uses supported webhook parameters and respects the plan gate", async () => {
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
  const requests: URL[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.has("requestId"), false);
    requests.push(url);
    assert.ok(JSON.stringify(JSON.parse(init?.body as string)).includes("/api/projects/project-test/feedback/issue-test/open"));
    return new Response(null, { status: 200 });
  });
  await triggerIntegrations(events[0]!, client);
  await triggerIntegrations(events[0]!, client);
  assert.equal(requests.length, 4);
  plan = "FREE";
  await triggerIntegrations(events[0]!, client);
  assert.equal(requests.length, 4);
});
