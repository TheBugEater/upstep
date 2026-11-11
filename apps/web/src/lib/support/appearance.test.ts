import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampRadius,
  parseColor,
  parseSupportAppearance,
  readableTextOn,
  safeFont,
  supportThemeVars,
} from "./appearance";

test("only hex and rgb colors pass validation", () => {
  for (const ok of [
    "#fff",
    "#ffff",
    "#0f172a",
    "#0f172acc",
    "rgb(15, 23, 42)",
    "rgba(15,23,42,.5)",
    "rgb(15 23 42 / 50%)",
  ])
    assert.ok(parseColor(ok), ok);
  for (const bad of [
    "red",
    "#ggg",
    "#12345",
    "rgb(300, 0, 0)",
    "rgba(0,0,0,2)",
    "red;background:url(https://evil.test)",
    "#fff;}",
    "var(--x)",
    "expression(alert(1))",
    `#${"f".repeat(100)}`,
  ])
    assert.equal(parseColor(bad), null, bad);
});

test("query parameters are validated on the server", () => {
  const look = parseSupportAppearance({
    theme: "dark",
    accent: "#1d4ed8",
    bg: "#0f172a",
    surface: "rgb(30, 41, 59)",
    border: "url(javascript:alert(1))",
    text: ["#f8fafc", "#000"],
    muted: "blue",
    radius: "400",
    font: "Inter, sans-serif",
  });
  assert.deepEqual(look, {
    dark: true,
    accent: "#1d4ed8",
    colors: { bg: "#0f172a", surface: "rgb(30, 41, 59)", text: "#f8fafc" },
    radius: 32,
    font: "Inter, sans-serif",
  });
  assert.equal(parseSupportAppearance({ accent: "teal" }).accent, undefined);
  assert.equal(safeFont("Inter;} body{display:none"), undefined);
  assert.equal(safeFont("x".repeat(201)), undefined);
});

test("radius is clamped and defaults to 12", () => {
  assert.equal(clampRadius(undefined), 12);
  assert.equal(clampRadius(""), 12);
  assert.equal(clampRadius("abc"), 12);
  assert.equal(clampRadius("-4"), 0);
  assert.equal(clampRadius("8.6"), 9);
  assert.equal(clampRadius(99), 32);
});

test("a chat with no overrides keeps its built-in neutrals", () => {
  const light = supportThemeVars(
    parseSupportAppearance({}),
    "#D97757",
  ) as Record<string, string>;
  assert.equal(light["--sx-bg"], "#ffffff");
  assert.equal(light["--sx-text"], "#0a0a0a");
  assert.equal(light["--sx-surface"], "#f5f5f5");
  assert.equal(light["--sx-border"], "#e5e5e5");
  assert.equal(light["--sx-accent-text"], "#ffffff");
  assert.equal(light["--sx-r12"], "12px");
  assert.equal(light["--sx-r24"], "24px");
  assert.equal(light["fontFamily"], undefined);
  const dark = supportThemeVars(
    parseSupportAppearance({ theme: "dark" }),
    "#D97757",
  ) as Record<string, string>;
  assert.equal(dark["--sx-bg"], "#000000");
  assert.equal(dark["--sx-surface"], "#171717");
});

test("overrides flow into the variables and derived shades follow them", () => {
  const vars = supportThemeVars(
    parseSupportAppearance({
      bg: "#0f172a",
      text: "#f8fafc",
      surface: "#1e293b",
      radius: "0",
      font: "Inter",
    }),
    "#facc15",
  ) as Record<string, string>;
  assert.equal(vars["--sx-bg"], "#0f172a");
  assert.equal(vars["--sx-ink"], "#f8fafc");
  assert.equal(vars["--sx-on-ink"], "#0f172a");
  assert.equal(vars["--sx-subtle"], "#172033");
  assert.equal(vars["--sx-r16"], "0px");
  assert.equal(vars["fontFamily"], "Inter");
  // Yellow is unreadable under white text, so the accent gets dark text.
  assert.equal(vars["--sx-accent-text"], "#1a1915");
});

test("accent text stays white on mid-tone brand colors and flips on light ones", () => {
  assert.equal(readableTextOn("#D97757"), "#ffffff");
  assert.equal(readableTextOn("#C9481F"), "#ffffff");
  assert.equal(readableTextOn("#FF7A50"), "#1a1915");
  assert.equal(readableTextOn("#E05A33"), "#ffffff");
  assert.equal(readableTextOn("rgb(29, 78, 216)"), "#ffffff");
  assert.equal(readableTextOn("#facc15"), "#1a1915");
  assert.equal(readableTextOn("#a7f3d0"), "#1a1915");
  assert.equal(readableTextOn("not a color"), "#ffffff");
});
