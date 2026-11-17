import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MobileApi,
  ApiError,
  normalizeServerUrl,
  parseNotificationTarget,
} from "../../../mobile/src/api";

test("native API rotates once for concurrent requests, saves credentials and retries with current access", async () => {
  let saved: string | null = null;
  let refreshes = 0;
  const access: string[] = [];
  const store = {
    get: async () => saved,
    set: async (value: string) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
    },
  };
  const transport: typeof fetch = async (_url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (body?.grantType) {
      if (body.grantType === "refresh") {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return Response.json({
        accessToken: body.grantType === "code" ? "old" : "new",
        refreshToken: "refresh",
        accessExpiresAt: new Date(
          Date.now() + (body.grantType === "code" ? 1000 : 3600_000),
        ).toISOString(),
      });
    }
    access.push(new Headers(init?.headers).get("authorization")!);
    return Response.json({ saved: true });
  };
  const api = new MobileApi("https://upstep.example", store, transport);
  await api.signIn("code", "verifier");
  await Promise.all([api.request("/api/one"), api.request("/api/two")]);
  assert.equal(refreshes, 1);
  assert.deepEqual(access, ["Bearer new", "Bearer new"]);
  assert.equal(
    await new MobileApi("https://other.example", store, transport).restore(),
    false,
  );
  assert.equal(
    saved,
    null,
    "credentials must never move to another backend origin",
  );
});

test("transient failures keep the native session; rejected refresh credentials clear it", async () => {
  let saved: string | null = JSON.stringify({
    origin: "https://upstep.example",
    accessToken: "old",
    refreshToken: "refresh",
    accessExpiresAt: new Date(0).toISOString(),
  });
  let fail = "network";
  const api = new MobileApi(
    "https://upstep.example",
    {
      get: async () => saved,
      set: async (value) => {
        saved = value;
      },
      clear: async () => {
        saved = null;
      },
    },
    async () => {
      if (fail === "network") throw new Error("offline");
      return Response.json({ error: "expired" }, { status: 401 });
    },
  );
  await api.restore();
  await assert.rejects(api.request("/api/one"), /offline/);
  assert.ok(saved);
  fail = "expired";
  await assert.rejects(
    api.request("/api/one"),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(saved, null);
});

test("self-hosted server addresses and notification targets stay bound to one origin", () => {
  assert.equal(normalizeServerUrl(" upstep.dev/ "), "https://upstep.dev");
  assert.equal(
    normalizeServerUrl("https://support.example.test:8443/"),
    "https://support.example.test:8443",
  );
  assert.equal(
    normalizeServerUrl("http://localhost:3000", true),
    "http://localhost:3000",
  );
  for (const value of [
    "",
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test/api",
    "https://example.test?key=value",
    "https://example.test#fragment",
    "javascript://example.test",
  ])
    assert.throws(() => normalizeServerUrl(value));
  const event = {
    serverUrl: "https://support.example.test",
    projectId: "project",
    conversationId: "conversation",
  };
  assert.deepEqual(parseNotificationTarget(event, event.serverUrl), {
    projectId: "project",
    conversationId: "conversation",
  });
  assert.equal(parseNotificationTarget(event, "https://upstep.dev"), null);
  assert.equal(
    parseNotificationTarget(
      { ...event, serverUrl: undefined },
      event.serverUrl,
    ),
    null,
  );
});

test("switching servers fences an in-flight unauthorized response from retrying on the new instance", async () => {
  let stored: string | null = null;
  let complete: (response: Response) => void = () => {};
  let started: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const requests: string[] = [];
  const api = new MobileApi(
    "https://first.example",
    {
      get: async () => stored,
      set: async (value) => {
        stored = value;
      },
      clear: async () => {
        stored = null;
      },
    },
    async (url) => {
      const address = String(url);
      requests.push(address);
      if (address.endsWith("/api/private")) {
        started();
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      }
      return Response.json({
        accessToken: "access",
        refreshToken: "refresh",
        accessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    },
  );
  await api.signIn("first-code", "verifier");
  const pending = api.request("/api/private");
  await ready;
  assert.throws(
    () => api.configureServer("https://second.example"),
    /Sign out/,
  );
  await api.clear();
  api.configureServer("https://second.example");
  await api.signIn("second-code", "verifier");
  complete(Response.json({ error: "old session rejected" }, { status: 401 }));
  await assert.rejects(pending, /server or sign-in changed/);
  assert.equal(
    requests.filter((url) => url.endsWith("/api/private")).length,
    1,
  );
  assert.equal(api.baseUrl, "https://second.example");
  assert.equal(api.hasSession, true);
});
