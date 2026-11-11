import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildWidgetPalette,
  clampRadius,
  mixColors,
  parseColor,
  readableTextOn,
  resolveColorOverrides,
  scaleRadius,
  supportThemeParams,
  withAlpha,
} from "../../../../packages/sdk-web/src/theme";
import { UpstepApiClient } from "../../../../packages/sdk-web/src/api";

test("widget palette is unchanged when nothing is overridden", () => {
  assert.deepEqual(buildWidgetPalette({ mode: "light" }), {
    dark: false,
    bg: "#ffffff",
    bgSoft: "#f5f5f5",
    bgHover: "#ededed",
    text: "#1a1915",
    textSoft: "#56544d",
    textFaint: "#9b9890",
    border: "#e8e6df",
    overlay: "rgba(26,25,21,.45)",
    accent: "#D97757",
    accentText: "#ffffff",
    accentTint: "#d977571a",
    radius: 12,
  });
  const dark = buildWidgetPalette({ mode: "dark", accentColor: "#1d4ed8" });
  assert.equal(dark.bg, "#000000");
  assert.equal(dark.textFaint, "#7d7a72");
  assert.equal(dark.accent, "#1d4ed8");
  assert.equal(dark.accentText, "#ffffff");
});

test("mode-specific colors win over shared ones", () => {
  const colors = {
    border: "#e2e8f0",
    text: "#0f172a",
    light: { background: "#f8fafc" },
    dark: { background: "#0f172a", text: "#f8fafc", border: "" },
  };
  assert.deepEqual(resolveColorOverrides(colors, "light"), {
    border: "#e2e8f0",
    text: "#0f172a",
    background: "#f8fafc",
  });
  // An empty string falls back rather than clearing the color.
  assert.deepEqual(resolveColorOverrides(colors, "dark"), {
    border: "#e2e8f0",
    text: "#f8fafc",
    background: "#0f172a",
  });
  const p = buildWidgetPalette({ mode: "dark", colors });
  assert.equal(p.bg, "#0f172a");
  assert.equal(p.text, "#f8fafc");
  assert.equal(p.border, "#e2e8f0");
  // Hover is derived from the surface and text so it stays on-brand.
  assert.equal(p.bgHover, mixColors("#171717", "#f8fafc", 0.06));
});

test("accent text is computed for contrast unless given", () => {
  assert.equal(
    buildWidgetPalette({ mode: "light", accentColor: "#facc15" }).accentText,
    "#1a1915",
  );
  assert.equal(
    buildWidgetPalette({
      mode: "light",
      accentColor: "#facc15",
      colors: { accentText: "#000000" },
    }).accentText,
    "#000000",
  );
  assert.equal(readableTextOn("#D97757"), "#ffffff");
  assert.equal(readableTextOn("teal"), "#ffffff");
});

test("named CSS colors still work on the web through color-mix()", () => {
  const p = buildWidgetPalette({
    mode: "light",
    accentColor: "teal",
    colors: { surface: "ivory" },
  });
  assert.equal(p.bgSoft, "ivory");
  assert.equal(p.bgHover, "color-mix(in srgb, ivory 94%, #1a1915)");
  assert.equal(p.accentTint, "color-mix(in srgb, teal 10%, transparent)");
});

test("color helpers parse hex and rgb and nothing else", () => {
  assert.deepEqual(parseColor("#abc"), [170, 187, 204, 1]);
  assert.deepEqual(parseColor("rgb(1 2 3 / 50%)"), [1, 2, 3, 0.5]);
  assert.equal(parseColor("hsl(0 0% 0%)"), null);
  assert.equal(withAlpha("#000000", 0.5), "#00000080");
  assert.equal(mixColors("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixColors("navy", "#ffffff", 0.5), null);
});

test("radius clamps and scales every built-in corner", () => {
  assert.equal(clampRadius(undefined), 12);
  assert.equal(clampRadius(-3), 0);
  assert.equal(clampRadius(80), 32);
  assert.equal(clampRadius(Number.NaN), 12);
  assert.equal(scaleRadius(20, 12), 20);
  assert.equal(scaleRadius(20, 0), 0);
  assert.equal(scaleRadius(20, 6), 10);
});

test("support chat URL keeps its old shape and carries only safe overrides", () => {
  const client = new UpstepApiClient({
    apiKey: "pk_1",
    baseUrl: "https://upstep.test/",
  });
  assert.equal(
    client.supportFrameUrl("light"),
    "https://upstep.test/support/pk_1?theme=light&accent=%23D97757",
  );
  const url = new URL(
    client.supportFrameUrl("dark", "#1d4ed8", {
      colors: {
        background: "teal",
        dark: { background: "#0f172a", textMuted: "rgb(148, 163, 184)" },
      },
      radius: 99,
      fontFamily: "Inter, sans-serif",
    }),
  );
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    theme: "dark",
    accent: "#1d4ed8",
    bg: "#0f172a",
    muted: "rgb(148, 163, 184)",
    radius: "32",
    font: "Inter, sans-serif",
  });
  assert.deepEqual(
    supportThemeParams({ mode: "light", colors: { background: "teal" } }),
    {},
  );
});
