import assert from "node:assert/strict";
import test from "node:test";
import { generateMcpKey, hashMcpKey, isMcpKey, MCP_KEY_PREFIX } from "./mcp-credentials";

test("generated MCP keys have the private-key prefix and enough entropy", () => {
  const first = generateMcpKey();
  const second = generateMcpKey();
  assert.ok(first.startsWith(MCP_KEY_PREFIX));
  assert.ok(isMcpKey(first));
  assert.notEqual(first, second);
  assert.ok(first.length >= MCP_KEY_PREFIX.length + 43);
});

test("MCP key digests are deterministic and do not retain plaintext", () => {
  const key = `${MCP_KEY_PREFIX}${"a".repeat(43)}`;
  const digest = hashMcpKey(key);
  assert.equal(digest, hashMcpKey(key));
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.ok(!digest.includes(key));
});

test("publishable SDK keys are rejected as MCP credentials", () => {
  assert.equal(isMcpKey("upstep_pk_public-key"), false);
  assert.equal(isMcpKey("upstep_legacy-public-key"), false);
  assert.equal(isMcpKey(""), false);
});
