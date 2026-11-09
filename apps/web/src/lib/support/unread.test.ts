import assert from "node:assert/strict";
import test from "node:test";
import { lastReadableId, preview, unreadAfter } from "./unread";
const thread = [
  { id: "1", role: "CUSTOMER" },
  { id: "2", role: "ASSISTANT" },
  { id: "s", role: "SYSTEM" },
  { id: "3", role: "CUSTOMER" },
  { id: "4", role: "AGENT" },
  { id: "5", role: "AGENT" },
];
test("unreadAfter counts AI and team messages after the seen message", () => {
  assert.deepEqual(
    unreadAfter(thread, "2").map((m) => m.id),
    ["4", "5"],
  );
  assert.equal(unreadAfter(thread, "5").length, 0);
});
test("unreadAfter ignores the customer's own and system messages", () => {
  assert.equal(unreadAfter(thread, "4").length, 1);
  assert.equal(unreadAfter(thread.slice(0, 4), "1").length, 1);
});
test("unreadAfter treats unknown or missing seen ids as read", () => {
  assert.equal(unreadAfter(thread, null).length, 0);
  assert.equal(unreadAfter(thread, "gone").length, 0);
});
test("lastReadableId skips system messages", () => {
  assert.equal(lastReadableId(thread), "5");
  assert.equal(lastReadableId([{ id: "s", role: "SYSTEM" }]), null);
});
test("preview flattens whitespace and truncates", () => {
  assert.equal(preview("a\n\n b   c"), "a b c");
  assert.equal(preview("x".repeat(200)).length, 120);
  assert.ok(preview("x".repeat(200)).endsWith("…"));
});
