import { test } from "node:test";
import assert from "node:assert/strict";
import { messageTokens, stripSourceTags } from "./message-format";

test("support replies render bold, code and https links as tokens, never HTML", () => {
  assert.deepEqual(
    messageTokens("In your project, open **Domains** and run `npx x`. See [the guide](https://a.test/g)."),
    [
      { type: "text", text: "In your project, open " },
      { type: "bold", text: "Domains" },
      { type: "text", text: " and run " },
      { type: "code", text: "npx x" },
      { type: "text", text: ". See " },
      { type: "link", text: "the guide", href: "https://a.test/g" },
      { type: "text", text: "." },
    ],
  );
  // Non-https links and unmatched markers stay as plain text.
  assert.deepEqual(messageTokens("[x](javascript:alert(1)) and **open"), [
    { type: "text", text: "[x](javascript:alert(1)) and **open" },
  ]);
  assert.deepEqual(messageTokens("<b>hi</b>"), [{ type: "text", text: "<b>hi</b>" }]);
});

test("inline source tags are removed because citations show below the reply", () => {
  assert.equal(
    stripSourceTags("Use a return-path MX record. [Source: domain setup guide]"),
    "Use a return-path MX record.",
  );
  assert.equal(stripSourceTags("Done (sources: pricing, docs)\nNext"), "Done\nNext");
  assert.equal(stripSourceTags("Keep [this link] and (this note)"), "Keep [this link] and (this note)");
});
