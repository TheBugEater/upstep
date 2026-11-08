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
import { extractCustomerEmail } from "./support/service";
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
                  inScope: true,
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

test("contact capture accepts only a customer's own explicit email, not business emails in questions", () => {
  assert.equal(
    extractCustomerEmail("My email is businesscodepulse@gmail.com"),
    "businesscodepulse@gmail.com",
  );
  assert.equal(
    extractCustomerEmail("businesscodepulse@gmail.com"),
    "businesscodepulse@gmail.com",
  );
  assert.equal(
    extractCustomerEmail("Is your support email support@example.com?"),
    null,
  );
  assert.equal(
    extractCustomerEmail("Reach me at first@example.com or second@example.com"),
    null,
  );
});

test("website learning sends a concrete input and keeps analysis separate from customer replies", async () => {
  const original = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-not-real";
  try {
    const ai = new OpenAIProvider(false, async (_url, options) => {
      const body = JSON.parse(options!.body as string);
      assert.ok(body.input.length > 0);
      assert.equal(body.text.format.name, "business_learning");
      assert.match(body.instructions, /business-specific support boundaries/);
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  businessName: "Acme",
                  summary: "Acme repairs bicycles.",
                  supportEmail: null,
                  suggestedInstructions:
                    "Help with repairs and escalate unresolved issues.",
                  facts: [],
                  questions: [],
                }),
              },
            ],
          },
        ],
      });
    });
    assert.equal(
      (await ai.learn({ domain: "example.com", sources: [] })).businessName,
      "Acme",
    );
  } finally {
    if (original === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = original;
  }
});

test("support presentation removes em dashes and separates readable paragraphs", async () => {
  const { formatSupportReply, replyWidgets } =
    await import("./support/presentation");
  assert.equal(
    formatSupportReply("Open settings — select Support.\nCheck the domain."),
    "Open settings, select Support.\n\nCheck the domain.",
  );
  assert.equal(
    formatSupportReply("The team can investigate.\n\n[0]"),
    "The team can investigate.",
  );
  assert.match(
    formatSupportReply("First step. Second step. Third step."),
    /\n\n/,
  );
  const base = {
    inScope: true,
    reply: "Try settings.",
    sources: [],
    offerTicket: false,
    handoff: false,
    ticketTitle: "",
    ticketType: "GENERAL" as const,
  };
  assert.deepEqual(
    replyWidgets(
      { ...base, inScope: false, requestDetails: true, quickReplies: ["Help"] },
      "one",
    ),
    [],
  );
  assert.equal(
    replyWidgets(
      { ...base, resolution: "clarify", requestDetails: true },
      "two",
    )[0]?.type,
    "issue_details",
  );
  assert.equal(
    replyWidgets(
      { ...base, resolution: "answer", askConfirmation: true },
      "three",
    )[0]?.type,
    "confirmation",
  );
  assert.deepEqual(
    replyWidgets(
      { ...base, resolution: "escalate", issueSummary: "Too vague" },
      "four",
    ),
    [],
  );
  assert.equal(
    replyWidgets(
      {
        ...base,
        resolution: "escalate",
        issueSummary: "Order has not arrived after the delivery date",
      },
      "five",
    )[0]?.type,
    "contact_form",
  );
});

test("asking for an agent cannot bypass AI diagnosis and a genuine help attempt", async () => {
  const { assessEscalation, hasTriedToHelp } =
    await import("./support/escalation");
  const premature = {
    inScope: true,
    reply: "Share your details for an agent.",
    sources: [],
    offerTicket: true,
    handoff: true,
    ticketTitle: "Invite cannot be accepted",
    ticketType: "BUG" as const,
    resolution: "escalate" as const,
    issueSummary: "Team invitation cannot be accepted",
    escalationReason: "unresolved" as const,
  };
  assert.equal(assessEscalation(premature, []).resolution, "clarify");
  const clarified = [
    { role: "ASSISTANT", metadata: { inScope: true, resolution: "clarify" } },
  ];
  assert.equal(assessEscalation(premature, clarified).resolution, "clarify");
  assert.equal(
    assessEscalation(
      { ...premature, escalationReason: "human_authority" },
      clarified,
    ).resolution,
    "escalate",
  );
  const tried = [
    { role: "ASSISTANT", metadata: { inScope: true, resolution: "answer" } },
  ];
  assert.equal(assessEscalation(premature, tried).resolution, "escalate");
  assert.equal(
    hasTriedToHelp(
      [
        {
          role: "ASSISTANT",
          metadata: { inScope: false, resolution: "answer" },
        },
      ],
      "unresolved",
    ),
    false,
  );
});

test("business icon discovery selects website branding and rejects unsafe image sources", async () => {
  const { extractBusinessLogo, normalizeBusinessLogo, businessLogo } =
    await import("./support/branding");
  const html =
    '<html><head><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/brand/icon.png"><meta property="og:image" content="https://cdn.example.com/hero.jpg"></head><body><header><img alt="Company logo" src="/wordmark.svg"></header></body></html>';
  assert.equal(
    extractBusinessLogo(html, "https://example.com/about"),
    "https://example.com/brand/icon.png",
  );
  assert.equal(
    extractBusinessLogo(
      '<script type="application/ld+json">{"@type":"Organization","logo":{"url":"https://cdn.example.com/logo.png"}}</script>',
      "https://example.com/",
    ),
    "https://cdn.example.com/logo.png",
  );
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/logo.png",
    "https://127.0.0.1/icon.png",
    "https://192.168.1.1/icon.png",
    "https://localhost/icon.png",
    "data:image/svg+xml,<svg/>",
    "https://user:secret@example.com/icon.png",
  ])
    assert.equal(normalizeBusinessLogo(url), null);
  assert.equal(
    businessLogo({ branding: { logoUrl: "https://example.com/logo.png" } }),
    "https://example.com/logo.png",
  );
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6rNwAAAAASUVORK5CYII=";
  assert.equal(normalizeBusinessLogo(png), png);
  assert.equal(normalizeBusinessLogo("data:image/png;base64,notapng"), null);
});
