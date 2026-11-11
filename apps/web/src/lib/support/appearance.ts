/**
 * Look of the hosted support chat (/support/[key]). The SDKs pass the host
 * project's colors, radius and font as query parameters. Everything is
 * validated here, on the server: only hex and rgb() colors, a clamped radius
 * and a plain font-family list get through. The chat then reads the result as
 * CSS variables.
 */
import type { CSSProperties } from "react";

export type SupportColorKey =
  | "bg"
  | "surface"
  | "border"
  | "text"
  | "muted"
  | "accentText";

export interface SupportAppearance {
  dark: boolean;
  /** Initial accent, when the URL carried a hex/rgb one. The host may still send another later. */
  accent?: string;
  colors: Partial<Record<SupportColorKey, string>>;
  radius: number;
  font?: string;
}

export const DEFAULT_SUPPORT_RADIUS = 12;
const MAX_RADIUS = 32;
const COLOR_KEYS: SupportColorKey[] = [
  "bg",
  "surface",
  "border",
  "text",
  "muted",
  "accentText",
];

type Rgba = [number, number, number, number];
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const N = "(\\d{1,3}(?:\\.\\d+)?)";
const A = "(\\d*\\.?\\d+%?)";
const RGB = new RegExp(
  `^rgba?\\(\\s*${N}\\s*(?:,\\s*${N}\\s*,\\s*${N}\\s*(?:,\\s*${A}\\s*)?|\\s+${N}\\s+${N}\\s*(?:\\/\\s*${A}\\s*)?)\\)$`,
  "i",
);

/** Hex (#rgb, #rgba, #rrggbb, #rrggbbaa) or rgb()/rgba(). Anything else is null. */
export function parseColor(input: unknown): Rgba | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const value = input.trim();
  if (HEX.test(value)) {
    let d = value.slice(1);
    if (d.length <= 4)
      d = d
        .split("")
        .map((c) => c + c)
        .join("");
    const ch = (i: number) => parseInt(d.slice(i, i + 2), 16);
    return [ch(0), ch(2), ch(4), d.length === 8 ? ch(6) / 255 : 1];
  }
  const m = RGB.exec(value);
  if (!m) return null;
  // Group 1 is red in both syntaxes; 2–4 are the comma form, 5–7 the space form.
  const [r, g, b, a] = [m[1], m[2] ?? m[5], m[3] ?? m[6], m[4] ?? m[7]];
  const rgb = [r, g, b].map(Number);
  if (rgb.some((c) => !(c >= 0 && c <= 255))) return null;
  let alpha = 1;
  if (a !== undefined) {
    alpha = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
    if (!(alpha >= 0 && alpha <= 1)) return null;
  }
  return [rgb[0]!, rgb[1]!, rgb[2]!, alpha];
}

function hex([r, g, b, a]: Rgba) {
  const h = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ""}`;
}

/** Blends `amount` of `toward` into `color`. Both are already-validated colors. */
function mix(color: string, toward: string, amount: number) {
  const a = parseColor(color);
  const b = parseColor(toward);
  if (!a || !b) return color;
  return hex([0, 1, 2, 3].map((i) => a[i]! + (b[i]! - a[i]!) * amount) as Rgba);
}

function luminance([r, g, b]: Rgba) {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgba, b: Rgba) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** White on the accent while it keeps 3:1 contrast, otherwise whichever of white or near-black reads better. */
export function readableTextOn(accent: string): string {
  const c = parseColor(accent);
  if (!c) return "#ffffff";
  const white = contrast(c, [255, 255, 255, 1]);
  if (white >= 3) return "#ffffff";
  return contrast(c, [26, 25, 21, 1]) > white ? "#1a1915" : "#ffffff";
}

export function clampRadius(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number")
    return DEFAULT_SUPPORT_RADIUS;
  const n = Number(value);
  if (value === "" || !Number.isFinite(n)) return DEFAULT_SUPPORT_RADIUS;
  return Math.round(Math.min(MAX_RADIUS, Math.max(0, n)));
}

/** A comma-separated list of font names; nothing that could escape a CSS value. */
export function safeFont(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const font = value.trim();
  return font && /^[\w\s,"'.-]{1,200}$/.test(font) ? font : undefined;
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Reads and validates the chat's look from the page's query parameters. Invalid values are dropped. */
export function parseSupportAppearance(params: Params): SupportAppearance {
  const colors: SupportAppearance["colors"] = {};
  for (const key of COLOR_KEYS) {
    const value = first(params[key])?.trim();
    if (value && parseColor(value)) colors[key] = value;
  }
  const accent = first(params["accent"])?.trim();
  const font = safeFont(first(params["font"]));
  return {
    dark: first(params["theme"]) === "dark",
    ...(accent && parseColor(accent) ? { accent } : {}),
    colors,
    radius: clampRadius(first(params["radius"])),
    ...(font ? { font } : {}),
  };
}

// The chat's built-in neutrals (Tailwind's neutral scale), so nothing changes without overrides.
const DEFAULTS = {
  light: {
    bg: "#ffffff",
    text: "#0a0a0a",
    softText: "#262626",
    strong: "#404040",
    surface: "#f5f5f5",
    subtle: "#fafafa",
    border: "#e5e5e5",
    hairline: "#f5f5f5",
    hoverBorder: "#a3a3a3",
    muted: "#737373",
    faint: "#a3a3a3",
    ink: "#171717",
    onInk: "#ffffff",
    disabled: "#d4d4d4",
    focus: "#171717",
  },
  dark: {
    bg: "#000000",
    text: "#ffffff",
    softText: "#f5f5f5",
    strong: "#d4d4d4",
    surface: "#171717",
    subtle: "#0a0a0a",
    border: "#262626",
    hairline: "#171717",
    hoverBorder: "#525252",
    muted: "#a3a3a3",
    faint: "#737373",
    ink: "#f5f5f5",
    onInk: "#171717",
    disabled: "#404040",
    focus: "#d4d4d4",
  },
};

/** CSS variables for the chat: defaults for the mode, overrides on top, shades derived from them. */
export function supportThemeVars(
  look: Pick<SupportAppearance, "dark" | "colors" | "radius" | "font">,
  accent: string,
): CSSProperties {
  const d = look.dark ? DEFAULTS.dark : DEFAULTS.light;
  const o = look.colors;
  const bg = o.bg ?? d.bg;
  const text = o.text ?? d.text;
  const surface = o.surface ?? d.surface;
  const border = o.border ?? d.border;
  const muted = o.muted ?? d.muted;
  const r = (designed: number) =>
    `${Math.round((designed * look.radius) / DEFAULT_SUPPORT_RADIUS)}px`;
  return {
    "--support-accent": accent,
    "--sx-accent-text": o.accentText ?? readableTextOn(accent),
    "--sx-bg": bg,
    "--sx-text": text,
    "--sx-soft-text": o.text ?? d.softText,
    "--sx-strong": o.text ? mix(text, bg, 0.2) : d.strong,
    "--sx-surface": surface,
    "--sx-subtle": o.surface || o.bg ? mix(surface, bg, 0.5) : d.subtle,
    "--sx-border": border,
    "--sx-hairline": o.border || o.bg ? mix(border, bg, 0.5) : d.hairline,
    "--sx-hover-border": o.border || o.muted ? muted : d.hoverBorder,
    "--sx-muted": muted,
    "--sx-faint": o.muted || o.bg ? mix(muted, bg, 0.3) : d.faint,
    "--sx-disabled": o.muted || o.bg ? mix(muted, bg, 0.55) : d.disabled,
    "--sx-ink": o.text ?? d.ink,
    "--sx-on-ink": o.text ? bg : d.onInk,
    "--sx-focus": o.text ?? d.focus,
    "--sx-r4": r(4),
    "--sx-r6": r(6),
    "--sx-r8": r(8),
    "--sx-r12": r(12),
    "--sx-r16": r(16),
    "--sx-r24": r(24),
    ...(look.font ? { fontFamily: look.font } : {}),
  } as CSSProperties;
}
