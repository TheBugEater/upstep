import assert from "node:assert/strict";
import test from "node:test";
import { generateInvitationToken, hashInvitationToken, isInvitationToken } from "./invitation-tokens";

test("invitation secrets have 256 bits of randomness and store only a deterministic digest", () => {
  const token = generateInvitationToken();
  assert.ok(isInvitationToken(token));
  assert.equal(Buffer.from(token, "base64url").length, 32);
  assert.notEqual(token, generateInvitationToken());
  const hash = hashInvitationToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashInvitationToken(token));
  assert.ok(!hash.includes(token));
  assert.equal(isInvitationToken(""), false);
  assert.equal(isInvitationToken(`${token}/extra`), false);
});
