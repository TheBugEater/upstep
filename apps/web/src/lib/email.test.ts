import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, mock, test } from "node:test";
import { sendEmail, sendFeedbackNotification } from "./email";
import { EMAIL_TEMPLATES, renderEmailTemplate } from "./email-templates";

const originalEnv = { ...process.env };
const message = {
  to: "businesscodepulse@gmail.com",
  subject: "Test email",
  text: "Plain-text email body",
};
const notification = {
  toEmail: message.to,
  projectName: "Upstep & friends",
  projectId: "project-test",
  feedback: {
    title: "A <bug>",
    content: "Details & more",
    type: "BUG",
    flagged: true,
    status: "PENDING",
  },
};

beforeEach(() => {
  process.env.SENDPANDA_API_KEY = "test-only-key";
  process.env.SENDPANDA_FROM_EMAIL = "UpStep Team <hello@upstep.dev>";
  delete process.env.SENDPANDA_FEEDBACK_TEMPLATE_ID;
  process.env.AUTH_URL = "https://upstep.dev";
  // All tests must stub fetch explicitly; never contact a real recipient.
  mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request in email test");
  });
});

afterEach(() => {
  mock.restoreAll();
  for (const name of ["SENDPANDA_API_KEY", "SENDPANDA_FROM_EMAIL", "SENDPANDA_FEEDBACK_TEMPLATE_ID", "AUTH_URL"]) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

test("sends the API contract with a fresh UUID for each new email", async () => {
  const keys = new Set<string>();
  mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(url, "https://api.sendpanda.email/v1/emails");
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-only-key");
    assert.equal(headers.get("Content-Type"), "application/json");
    const key = headers.get("Idempotency-Key")!;
    assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    keys.add(key);
    assert.deepEqual(JSON.parse(init?.body as string), {
      from: "UpStep Team <hello@upstep.dev>",
      ...message,
      to: [message.to],
    });
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response('{"id":"email-test","status":"queued"}', { status: 202 });
  });
  await sendEmail(message);
  await sendEmail(message);
  assert.equal(keys.size, 2);
});

test("supports HTML and recipient arrays, with the placeholder sender as default", async () => {
  delete process.env.SENDPANDA_FROM_EMAIL;
  mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(init?.body as string), {
      from: "UpStep Team <hello@your-verified-domain.example>",
      ...message,
      to: [message.to],
      html: "<p>Test</p>",
    });
    // Any 2xx is acceptance, even if there is no JSON response body.
    return new Response(null, { status: 204 });
  });
  await sendEmail({ ...message, to: [message.to], html: "<p>Test</p>" });
});

test("errors include HTTP status and the complete provider response body", async () => {
  const body = '{"error":"sender_domain_not_verified","details":"Verify the domain"}';
  mock.method(globalThis, "fetch", async () => new Response(body, { status: 403 }));
  await assert.rejects(sendEmail(message), {
    message: `SendPanda request failed (403): ${body}`,
  });
});

test("caller-provided UUID stays the same when retrying a failed request", async () => {
  const idempotencyKey = randomUUID();
  let attempts = 0;
  mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), idempotencyKey);
    attempts++;
    return new Response(null, { status: attempts === 1 ? 503 : 202 });
  });
  await assert.rejects(sendEmail({ ...message, idempotencyKey }));
  await sendEmail({ ...message, idempotencyKey });
  assert.equal(attempts, 2);
});

test("missing credentials throw for direct sends and keep feedback notifications optional", async () => {
  delete process.env.SENDPANDA_API_KEY;
  await assert.rejects(sendEmail(message), { message: "SENDPANDA_API_KEY is not configured." });
  await sendFeedbackNotification(notification);
});

test("feedback notifications preserve content and forward their persisted UUID", async () => {
  const idempotencyKey = randomUUID();
  mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), idempotencyKey);
    const body = JSON.parse(init?.body as string);
    assert.equal(body.subject, "New bug report on Upstep & friends");
    assert.deepEqual(body.to, [message.to]);
    assert.match(body.html, /A &lt;bug&gt;/);
    assert.match(body.html, /Upstep &amp; friends/);
    assert.match(body.html, /Pending review/);
    assert.match(body.html, /Flagged/);
    assert.match(body.text, /Details & more/);
    assert.match(body.text, /Pending review/);
    assert.match(body.text, /Flagged/);
    assert.match(body.text, /The UpStep Team/);
    assert.match(body.text, /https:\/\/upstep.dev\/dashboard\/projects\/project-test/);
    return new Response(null, { status: 202 });
  });
  await sendFeedbackNotification({ ...notification, idempotencyKey });
});

test("published feedback templates receive variables without inline HTML or text", async () => {
  process.env.SENDPANDA_FEEDBACK_TEMPLATE_ID = "tpl_feedback_test";
  mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string);
    assert.equal(body.template_id, "tpl_feedback_test");
    assert.equal(body.html, undefined);
    assert.equal(body.text, undefined);
    assert.equal(body.subject, undefined);
    assert.equal(body.variables.title, "A <bug>");
    assert.equal(body.variables.pending_display, "inline-block");
    const rendered = renderEmailTemplate(EMAIL_TEMPLATES.feedback, body.variables);
    assert.equal(rendered.subject, "New bug report on Upstep & friends");
    assert.match(rendered.html, /A &lt;bug&gt;/);
    assert.match(rendered.html, /The UpStep Team/);
    assert.ok(!rendered.html.includes("{{"));
    return new Response(null, { status: 202 });
  });
  await sendFeedbackNotification(notification);
});

test("local template rendering rejects missing variables and subject header injection", () => {
  assert.throws(() => renderEmailTemplate(EMAIL_TEMPLATES.feedback, {}), /Missing email template variable/);
  assert.throws(() => renderEmailTemplate(EMAIL_TEMPLATES.feedback, { subject: "Bad\r\nBcc: someone@example.com" }), /Invalid email subject/);
});
