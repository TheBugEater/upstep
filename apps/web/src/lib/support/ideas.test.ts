import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIdeaPrompt, ideaKeywords, rankIdeas } from "./ideas";
import { replyWidgets } from "./presentation";

test("idea keywords drop filler words and fold simple plurals", () => {
  assert.deepEqual(ideaKeywords("Please add Dark Mode to the dashboards"), [
    "dark",
    "mode",
    "dashboard",
  ]);
  assert.deepEqual(ideaKeywords("Can you add it?"), []);
});

test("matching ideas rank title hits first and ignore weak overlaps", () => {
  const items = [
    {
      id: "a",
      title: null,
      content: "A dark theme for night use",
      upvotes: 50,
    },
    { id: "b", title: "Dark mode", content: "Easier on the eyes", upvotes: 3 },
    {
      id: "c",
      title: "Export to CSV",
      content: "Spreadsheet mode",
      upvotes: 90,
    },
    { id: "d", title: "Dark mode for the dashboard", content: "x", upvotes: 8 },
  ];
  const ranked = rankIdeas("Dark mode for the dashboard", items);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["d", "b"],
  );
  assert.equal(rankIdeas("Something unrelated entirely", items).length, 0);
  assert.equal(ranked[0]!.title, "Dark mode for the dashboard");
});

test("long idea text is shortened for the chat card", () => {
  const [match] = rankIdeas("calendar sync", [
    {
      id: "x",
      title: null,
      content: `Calendar sync ${"x".repeat(200)}`,
      upvotes: 1,
    },
  ]);
  assert.ok(match!.title.length <= 120);
  assert.ok(match!.title.endsWith("…"));
});

test("idea prompts are keyed to the customer turn", () => {
  const prompt = buildIdeaPrompt("msg1", "  Dark mode  ", []);
  assert.equal(prompt.id, "idea:msg1");
  assert.equal(prompt.suggestedTitle, "Dark mode");
  assert.equal(prompt.title, "Add this to the ideas board");
});

test("feature requests get the ideas card instead of details or confirmation forms", () => {
  const widgets = replyWidgets(
    {
      inScope: true,
      resolution: "answer",
      featureRequest: true,
      askConfirmation: true,
      requestDetails: true,
      quickReplies: [],
      reply: "Not yet. You can vote for it below.",
      sources: [],
      offerTicket: false,
      handoff: false,
      ticketTitle: "Dark mode",
      ticketType: "FEATURE",
    },
    "turn",
  );
  assert.deepEqual(widgets, []);
});
