import assert from "node:assert/strict";
import { test } from "node:test";
import {
  avatarFromProfile,
  avatarInitials,
  avatarOptions,
  canUseAvatarSource,
  effectiveAvatarSource,
  resolveAvatar,
  safeAvatarUrl,
} from "./avatar";

const GITHUB = "https://avatars.githubusercontent.com/u/123?v=4";
const GOOGLE = "https://lh3.googleusercontent.com/a/abc=s96-c";
const github = { provider: "github", image: GITHUB, createdAt: new Date("2026-01-01") };
const google = { provider: "google", image: GOOGLE, createdAt: new Date("2026-02-01") };

test("reads GitHub avatar_url and Google picture from OAuth profiles", () => {
  assert.equal(avatarFromProfile("github", { avatar_url: GITHUB, picture: GOOGLE }), GITHUB);
  assert.equal(avatarFromProfile("google", { picture: GOOGLE, avatar_url: GITHUB }), GOOGLE);
  assert.equal(avatarFromProfile("google", { picture: 42 }), null);
  assert.equal(avatarFromProfile("gitlab", { avatar_url: GITHUB }), null);
  assert.equal(avatarFromProfile("github", undefined), null);
});

test("only accepts absolute https URLs", () => {
  assert.equal(safeAvatarUrl(GITHUB), GITHUB);
  assert.equal(safeAvatarUrl("http://avatars.githubusercontent.com/u/1"), null);
  assert.equal(safeAvatarUrl("javascript:alert(1)"), null);
  assert.equal(safeAvatarUrl("/relative.png"), null);
  assert.equal(safeAvatarUrl(""), null);
  assert.equal(safeAvatarUrl(`https://example.com/${"a".repeat(3000)}`), null);
  assert.equal(safeAvatarUrl(null), null);
});

test("an explicit provider choice shows that provider's picture", () => {
  assert.equal(resolveAvatar({ source: "GITHUB", accounts: [github, google] }), GITHUB);
  assert.equal(resolveAvatar({ source: "GOOGLE", accounts: [github, google] }), GOOGLE);
});

test("initials always win when chosen", () => {
  assert.equal(resolveAvatar({ source: "INITIALS", accounts: [github, google] }), null);
});

test("falls back to initials when the chosen provider has no usable picture", () => {
  assert.equal(resolveAvatar({ source: "GOOGLE", accounts: [github] }), null);
  assert.equal(resolveAvatar({ source: "GITHUB", accounts: [{ ...github, image: null }, google] }), null);
  assert.equal(resolveAvatar({ source: "GITHUB", accounts: [{ ...github, image: "http://insecure.example/a.png" }] }), null);
});

test("with no choice, uses the provider the user signed up with", () => {
  assert.equal(resolveAvatar({ source: null, accounts: [google, github] }), GITHUB);
  assert.equal(resolveAvatar({ source: undefined, accounts: [google] }), GOOGLE);
  assert.equal(resolveAvatar({ source: null, accounts: [] }), null);
  assert.equal(effectiveAvatarSource({ source: null, accounts: [google, github] }), "GITHUB");
  assert.equal(effectiveAvatarSource({ source: null, accounts: [] }), "INITIALS");
  assert.equal(effectiveAvatarSource({ source: "INITIALS", accounts: [github] }), "INITIALS");
});

test("ignores providers that have no avatar support", () => {
  const email = { provider: "nodemailer", image: "https://example.com/a.png", createdAt: new Date("2025-01-01") };
  assert.equal(resolveAvatar({ source: null, accounts: [email, google] }), GOOGLE);
  assert.deepEqual(avatarOptions([email]).map((o) => o.source), ["INITIALS"]);
});

test("the picker lists only linked providers, in sign-up order, then initials", () => {
  assert.deepEqual(avatarOptions([google, github]), [
    { source: "GITHUB", label: "GitHub", image: GITHUB },
    { source: "GOOGLE", label: "Google", image: GOOGLE },
    { source: "INITIALS", label: "Initials", image: null },
  ]);
  assert.deepEqual(avatarOptions([google]).map((o) => o.source), ["GOOGLE", "INITIALS"]);
  // Two linked GitHub accounts appear once, using the first available picture.
  assert.deepEqual(avatarOptions([{ ...github, image: null }, { ...github, createdAt: new Date("2026-03-01") }])[0], { source: "GITHUB", label: "GitHub", image: GITHUB });
});

test("users can only choose initials or a provider they linked", () => {
  assert.equal(canUseAvatarSource("INITIALS", []), true);
  assert.equal(canUseAvatarSource("GITHUB", [github]), true);
  assert.equal(canUseAvatarSource("GOOGLE", [github]), false);
});

test("initials come from the name, or the email when there is no name", () => {
  assert.equal(avatarInitials("Ada Lovelace"), "AL");
  assert.equal(avatarInitials("Grace Brewster Hopper"), "GH");
  assert.equal(avatarInitials("cher"), "C");
  assert.equal(avatarInitials(null, "sam.jones@example.com"), "SJ");
  assert.equal(avatarInitials("  ", "x@example.com"), "X");
  assert.equal(avatarInitials(undefined, undefined), "?");
});
