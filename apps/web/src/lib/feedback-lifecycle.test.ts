import assert from "node:assert/strict";
import test from "node:test";
import { feedbackLifecycle } from "./feedback-lifecycle";

test("board moves map In Progress to its lifecycle instead of Open", () => {
  for (const name of ["In Progress", "in progress", " IN-PROGRESS ", "IN_PROGRESS"]) {
    assert.equal(feedbackLifecycle({ name, isDone: false }), "IN_PROGRESS");
  }
  assert.equal(feedbackLifecycle({ name: "Open", isDone: false }), "OPEN");
  assert.equal(feedbackLifecycle({ name: "Review", isDone: false }), "OPEN");
});

test("custom active-work names accept an explicit lifecycle, and reopening resets it", () => {
  assert.equal(feedbackLifecycle({ name: "Building", isDone: false }, "IN_PROGRESS"), "IN_PROGRESS");
  assert.equal(feedbackLifecycle({ name: "Backlog", isDone: false }, "OPEN"), "OPEN");
  assert.equal(feedbackLifecycle({ name: "Shipped", isDone: true }), "DONE");
  assert.equal(feedbackLifecycle({ name: "In Progress", isDone: true }), "DONE");
});

test("contradictory board and lifecycle states are rejected", () => {
  assert.throws(() => feedbackLifecycle({ name: "Building", isDone: false }, "DONE"));
  assert.throws(() => feedbackLifecycle({ name: "Shipped", isDone: true }, "IN_PROGRESS"));
  assert.throws(() => feedbackLifecycle({ name: "Done", isDone: true }, "OPEN"));
});
