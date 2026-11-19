import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActionUrl,
  connectorData,
  parseConnectorInput,
  connectorActionSchema,
  executeLookups,
  lookupTools,
  normalizeBaseUrl,
  openSecret,
  redactFields,
  runConnectorAction,
  sealSecret,
  usableActions,
  type ConnectorAction,
  type ConnectorFetcher,
} from "./connectors";

process.env.SUPPORT_CONNECTOR_SECRET = "test-connector-secret";

const action = (over: Partial<ConnectorAction> = {}): ConnectorAction => ({
  id: "a1",
  name: "get_schedule",
  description: "Use when the customer asks about their next delivery.",
  path: "/customers/{customer_id}/schedule",
  scope: "CUSTOMER",
  enabled: true,
  inputs: [],
  hiddenFields: [],
  ...over,
});
const verified = { externalId: "cus_8213", email: "priya@example.com", verified: true };
const guest = { externalId: null, email: null, verified: false };
const connector = {
  id: "c1",
  projectId: "p1",
  name: "Roastery API",
  baseUrl: "https://api.example.com/v1",
  authType: "BEARER",
  authHeader: null,
  secretCipher: null as string | null,
  actions: [action()],
};

test("base URLs must be public HTTPS without credentials, ports or queries", () => {
  assert.equal(normalizeBaseUrl("https://api.example.com/v1/"), "https://api.example.com/v1");
  for (const bad of [
    "http://api.example.com",
    "https://user:pw@api.example.com",
    "https://api.example.com:8443",
    "https://127.0.0.1/v1",
    "https://[::1]/v1",
    "https://localhost/v1",
    "https://db.internal/v1",
    "https://api.example.com/v1?key=1",
    "not a url",
  ])
    assert.throws(() => normalizeBaseUrl(bad), bad);
});

test("action validation enforces identity scoping and declared inputs", () => {
  assert.ok(connectorActionSchema.safeParse(action()).success);
  // Customer data must be scoped by the signed-in identity.
  assert.equal(
    connectorActionSchema.safeParse(action({ path: "/orders/{order}", inputs: [{ name: "order", description: "" }] })).success,
    false,
  );
  // Public actions can't read identity.
  assert.equal(connectorActionSchema.safeParse(action({ scope: "PUBLIC" })).success, false);
  assert.ok(connectorActionSchema.safeParse(action({ scope: "PUBLIC", path: "/roasts?limit=5" })).success);
  // Undeclared placeholders, identity as input, traversal and host changes are rejected.
  for (const bad of [
    action({ path: "/customers/{customer_id}/orders/{order}" }),
    action({ inputs: [{ name: "customer_id", description: "" }] }),
    action({ path: "/../admin/{customer_id}" }),
    action({ path: "//evil.com/{customer_id}" }),
    action({ path: "customers/{customer_id}" }),
    action({ path: "/customers/{Customer_Id}" }),
  ])
    assert.equal(connectorActionSchema.safeParse(bad).success, false, bad.path);
});

test("URLs are filled from the verified identity and encoded inputs, never leaving the base", () => {
  const url = buildActionUrl(
    "https://api.example.com/v1",
    action({ path: "/customers/{customer_id}/orders/{order}?email={customer_email}", inputs: [{ name: "order", description: "" }] }),
    verified,
    { order: "NW-20418" },
  );
  assert.equal(url.href, "https://api.example.com/v1/customers/cus_8213/orders/NW-20418?email=priya%40example.com");
  // Path separators and query characters in inputs are encoded, not interpreted.
  assert.throws(() =>
    buildActionUrl("https://api.example.com/v1", action({ path: "/customers/{customer_id}/orders/{order}", inputs: [{ name: "order", description: "" }] }), verified, { order: "../../admin" }),
  );
  const encoded = buildActionUrl(
    "https://api.example.com/v1",
    action({ path: "/customers/{customer_id}/orders/{order}", inputs: [{ name: "order", description: "" }] }),
    verified,
    { order: "A #1" },
  );
  assert.equal(encoded.pathname, "/v1/customers/cus_8213/orders/A%20%231");
  // Guests never get customer lookups.
  assert.throws(() => buildActionUrl("https://api.example.com/v1", action(), guest));
  assert.equal(usableActions([action()], guest).length, 0);
  assert.equal(usableActions([action(), action({ id: "a2", enabled: false })], verified).length, 1);
});

test("sensitive and hidden fields are removed before the AI sees a response", () => {
  const out = redactFields(
    { plan: "monthly", api_token: "x", nested: { password: "p", phone: "555", address: { line1: "1 Main" } }, items: [{ card_number: "4242" }] },
    ["phone", "nested.address"],
  ) as Record<string, any>;
  assert.equal(out.plan, "monthly");
  assert.equal(out.api_token, "[removed]");
  assert.equal(out.nested.password, "[removed]");
  assert.equal(out.nested.phone, "[removed]");
  assert.equal(out.nested.address, "[removed]");
  assert.equal(out.items[0].card_number, "[removed]");
});

test("secrets round-trip and are bound to their project", () => {
  const sealed = sealSecret("sk_live_abc123", "p1");
  assert.ok(!sealed.includes("sk_live"));
  assert.equal(openSecret(sealed, "p1"), "sk_live_abc123");
  assert.throws(() => openSecret(sealed, "p2"));
});

test("lookups send the decrypted credential, cap calls and never throw", async () => {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const fetcher: ConnectorFetcher = async (url, headers) => {
    seen.push({ url: url.href, headers });
    if (url.pathname.endsWith("/fail")) throw new Error("ECONNRESET 10.0.0.1");
    return { status: 200, data: { next_ship_date: "2026-12-03", token: "secret" } };
  };
  const c = {
    ...connector,
    secretCipher: sealSecret("sk_test_123456789", "p1"),
    actions: [action(), action({ id: "a2", name: "broken", path: "/customers/{customer_id}/fail" })],
  };
  const tools = lookupTools([c], verified);
  assert.equal(tools.length, 2);
  const results = await executeLookups(
    [
      { tool: "t1", inputs: [] },
      { tool: "t1", inputs: [] },
      { tool: "t2", inputs: [{ name: "ignored", value: "x" }] },
      { tool: "t9", inputs: [] },
    ],
    tools,
    verified,
    fetcher,
  );
  assert.equal(results.length, 2);
  assert.equal(seen[0]!.headers.Authorization, "Bearer sk_test_123456789");
  assert.ok(results[0]!.ok);
  assert.match(results[0]!.data!, /2026-12-03/);
  assert.doesNotMatch(results[0]!.data!, /secret/);
  assert.equal(results[1]!.ok, false);
  assert.equal(results[1]!.error, "The lookup failed.");
  // Guests see no customer tools at all.
  assert.equal(lookupTools([c], guest).length, 0);
});

test("API errors are reported without leaking the body", async () => {
  const result = await runConnectorAction(connector, action(), verified, {}, async () => ({
    status: 500,
    data: { stack: "internal" },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.error, "The API answered HTTP 500.");
  assert.equal(result.data, undefined);
});

test("saving keeps, replaces or clears the credential and never stores it in plain text", () => {
  const input = parseConnectorInput({
    name: "Roastery API",
    baseUrl: "https://api.example.com/v1/",
    authType: "HEADER",
    authHeader: "X-Api-Key",
    secret: "key_1234567890abcd",
    enabled: true,
    actions: [action()],
  });
  const first = connectorData("p1", input);
  assert.equal(first.baseUrl, "https://api.example.com/v1");
  assert.equal(first.secretHint, "abcd");
  assert.ok(first.secretCipher && !first.secretCipher.includes("key_1234"));
  const kept = connectorData("p1", { ...input, secret: undefined }, first);
  assert.equal(kept.secretCipher, first.secretCipher);
  assert.throws(() => connectorData("p1", { ...input, secret: "" }, first));
  const none = connectorData("p1", { ...input, authType: "NONE", secret: undefined }, first);
  assert.equal(none.secretCipher, null);
  assert.throws(() => connectorData("p1", { ...input, actions: [action(), action({ id: "a2" })] }));
  assert.throws(() => parseConnectorInput({ ...input, authHeader: "Cookie" }));
});
