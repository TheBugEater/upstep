import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  crawlUrl,
  extractKnowledge,
  isPublicAddress,
  normalizeDomain,
  fetchBusinessPage,
} from "./support/crawler";
import { identitySecret, verifyIdentity } from "./support/identity";
import { supportLimits } from "./support/policy";
import { OpenAIProvider } from "./support/ai";

test("business crawling rejects credentials, private addresses, off-domain redirects and sensitive paths", () => {
  assert.equal(normalizeDomain("https://www.example.com/docs"), "example.com");
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "https://127.0.0.1",
    "https://example.com:8443",
  ])
    assert.throws(() => normalizeDomain(url));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "fe80::1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  for (const url of [
    "http://example.com",
    "https://evil.example.com",
    "https://example.com@evil.com",
    "/api/users",
    "/dashboard",
    "/%61ccount",
    "/logo.svg",
  ])
    assert.equal(crawlUrl(url, "example.com"), null, url);
  assert.equal(
    crawlUrl("/docs?secret=hidden#one", "example.com"),
    "https://example.com/docs",
  );
});
test("knowledge extraction removes active content and retains readable business information", () => {
  const data = extractKnowledge(
    '<html><title>Acme help</title><body><nav>private menu</nav><main><h1>Returns</h1><p>Returns are accepted within 30 days.</p><script>evil()</script><a href="/help">Help</a></main></body></html>',
    "https://example.com/",
    "example.com",
  );
  assert.equal(data.title, "Acme help");
  assert.match(data.content, /30 days/);
  assert.doesNotMatch(data.content, /evil|private menu/);
  assert.deepEqual(data.links, ["https://example.com/help"]);
});
test("customer identities require project-specific signatures, short expiry, and stable customer IDs", () => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "support-test-only";
  const now = Math.floor(Date.now() / 1000);
  function sign(claims: object, project = "one") {
    const head = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${head}.${body}.${createHmac("sha256", identitySecret(project)).update(`${head}.${body}`).digest("base64url")}`;
  }
  const claims = {
    sub: "customer-1",
    aud: "one",
    iat: now,
    exp: now + 300,
    email: "businesscodepulse@gmail.com",
  };
  assert.equal(verifyIdentity(sign(claims), "one").sub, "customer-1");
  assert.throws(() => verifyIdentity(sign(claims), "two"));
  assert.throws(() => verifyIdentity(sign({ ...claims, exp: now - 1 }), "one"));
  assert.throws(() =>
    verifyIdentity(sign({ ...claims, exp: now + 3600 }), "one"),
  );
  assert.throws(() => verifyIdentity(sign({ ...claims, sub: "" }), "one"));
});
test("paid support limits are finite, with no AI allowance on Free", () => {
  assert.equal(supportLimits("FREE").enabled, false);
  assert.equal(supportLimits("PRO").aiReplies, 300);
  assert.equal(supportLimits("BUSINESS").aiReplies, 1500);
});
test("OpenAI adapter uses Luna Responses with strict output, validates citations and redacts errors", async () => {
  const before = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-not-real";
  const oldModel = process.env.SUPPORT_AI_MODEL;
  delete process.env.SUPPORT_AI_MODEL;
  try {
    const input = {
      businessName: "Acme",
      welcomeMessage: "Hello",
      sources: [
        {
          url: "https://example.com/",
          title: "Help",
          content: "Return within 30 days.",
        },
      ],
      messages: [{ role: "CUSTOMER", content: "Can I return this?" }],
    };
    const transport: typeof fetch = async (url, options) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      const body = JSON.parse(options!.body as string);
      assert.equal(body.model, "gpt-6-luna");
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.match(body.instructions, /untrusted data/);
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  reply: "Within 30 days.",
                  sources: [0, 99],
                  offerTicket: false,
                  handoff: false,
                  ticketTitle: "",
                  ticketType: "GENERAL",
                }),
              },
            ],
          },
        ],
      });
    };
    const result = await new OpenAIProvider(false, transport).reply(input);
    assert.deepEqual(result.sources, [0]);
    await assert.rejects(
      new OpenAIProvider(
        false,
        async () => new Response("secret provider error", { status: 401 }),
      ).reply(input),
      (e) => e instanceof Error && !e.message.includes("secret"),
    );
    await assert.rejects(
      new OpenAIProvider(false, async () =>
        Response.json({ status: "incomplete", output: [] }),
      ).reply(input),
      /did not complete/,
    );
  } finally {
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
    if (oldModel !== undefined) process.env.SUPPORT_AI_MODEL = oldModel;
  }
});

test("crawler blocks local-network fetches and off-domain destinations before HTTP", async () => {
  await assert.rejects(
    fetchBusinessPage("https://127.0.0.1/", "127.0.0.1"),
    /public addresses/,
  );
  await assert.rejects(
    fetchBusinessPage("https://evil.example/", "example.com"),
    /outside the business domain/,
  );
});
