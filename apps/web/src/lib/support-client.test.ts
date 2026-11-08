import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SupportClient,
  SupportApiError,
} from "../../../../packages/sdk-web/src/support";

test("portable support serializes sessions, persists anonymous tokens, and deduplicates structured actions", async () => {
  const saved = new Map<string, string>();
  const calls: { path: string; body: any; authorization: string | null }[] = [];
  const storage = {
    async getItem(k: string) {
      return saved.get(k) ?? null;
    },
    async setItem(k: string, v: string) {
      saved.set(k, v);
    },
    async removeItem(k: string) {
      saved.delete(k);
    },
  };
  const transport: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname.replace("/api/sdk/support", "");
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({
      path,
      body,
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.redirect, "error");
    if (!path && body)
      return Response.json({ token: "anonymous-private-token" });
    if (path === "/conversations")
      return Response.json({ conversations: [{ id: "one", state: "AI" }] });
    return Response.json({ ok: true });
  };
  const client = new SupportClient(
    { apiKey: "public-project-key" },
    storage,
    transport,
  );
  await Promise.all([client.conversations(), client.conversations()]);
  assert.equal(calls.filter((c) => !c.path).length, 1);
  assert.equal(saved.size, 1);
  await client.send("one", "Question", "00000000-0000-4000-8000-000000000001");
  await client.details("one", {
    widgetId: "details:1",
    summary: "Order is missing",
    clientMessageId: "00000000-0000-4000-8000-000000000002",
  });
  await client.handoff("one", "Taylor", "businesscodepulse@gmail.com");
  assert.equal(calls.at(-1)!.body.action, "handoff");
  assert.equal(calls.at(-1)!.authorization, "Bearer anonymous-private-token");
  assert.equal(
    calls.at(-2)!.body.clientMessageId,
    "00000000-0000-4000-8000-000000000002",
  );
  await client.identify("signed-customer-identity");
  await client.conversations();
  assert.equal(saved.size, 0);
  assert.deepEqual(calls.filter((c) => !c.path).at(-1)!.body, {
    identityToken: "signed-customer-identity",
  });
  await client.identify(undefined);
  await client.conversations();
  assert.equal(saved.size, 1);
});
test("portable support hides disabled plans and surfaces handoff validation", async () => {
  const client = new SupportClient(
    { apiKey: "public-key" },
    undefined,
    async () => Response.json({ error: "Paid support only" }, { status: 402 }),
  );
  assert.equal(await client.configuration(), null);
  const blocked = new SupportClient(
    { apiKey: "public-key" },
    undefined,
    async (_url, options) => {
      const body = JSON.parse(String(options?.body || "{}"));
      return body.action
        ? Response.json(
            { error: "Understand the issue first" },
            { status: 409 },
          )
        : Response.json({ token: "session" });
    },
  );
  await assert.rejects(
    blocked.handoff("one", "Taylor", "businesscodepulse@gmail.com"),
    (error: unknown) =>
      error instanceof SupportApiError && error.status === 409,
  );
});
