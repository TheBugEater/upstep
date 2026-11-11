/**
 * Portable theming helpers shared by the web widget, the React provider and
 * the React Native SDK. No DOM or browser globals.
 */
import type { UpstepColorOverrides, UpstepThemeColors } from "@upstep/types";

/** Brand orange for light panels; white text reads on it. */
export const DEFAULT_ACCENT_LIGHT = "#C9481F";
/** Brighter brand orange for dark panels; dark text reads on it. */
export const DEFAULT_ACCENT_DARK = "#FF7A50";
/** The light-mode default, kept for callers that need a single color. */
export const DEFAULT_ACCENT = DEFAULT_ACCENT_LIGHT;

/** The accent to use: the host's own, or the brand default for the mode. */
export function defaultAccent(mode: "light" | "dark"): string {
  return mode === "dark" ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT;
}
/** Base corner radius in px. Every other corner in the widgets scales from it. */
export const DEFAULT_RADIUS = 12;
export const MAX_RADIUS = 32;

/** Red, green, blue in 0–255 and alpha in 0–1. */
export type Rgba = [number, number, number, number];

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUMBER = "(\\d{1,3}(?:\\.\\d+)?)";
const ALPHA = "(\\d*\\.?\\d+%?)";
// rgb(1, 2, 3) · rgba(1, 2, 3, .5) · rgb(1 2 3) · rgb(1 2 3 / 50%)
const RGB = new RegExp(
  `^rgba?\\(\\s*${NUMBER}\\s*(?:,\\s*${NUMBER}\\s*,\\s*${NUMBER}\\s*(?:,\\s*${ALPHA}\\s*)?|\\s+${NUMBER}\\s+${NUMBER}\\s*(?:\\/\\s*${ALPHA}\\s*)?)\\)$`,
  "i",
);

/** Parses hex (#rgb, #rgba, #rrggbb, #rrggbbaa) and rgb()/rgba() colors. Anything else is null. */
export function parseColor(input: unknown): Rgba | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const value = input.trim();
  if (HEX.test(value)) {
    let digits = value.slice(1);
    if (digits.length <= 4)
      digits = digits
        .split("")
        .map((c) => c + c)
        .join("");
    const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return [
      channel(0),
      channel(2),
      channel(4),
      digits.length === 8 ? Math.round((channel(6) / 255) * 1000) / 1000 : 1,
    ];
  }
  const match = RGB.exec(value);
  if (!match) return null;
  // Group 1 is red in both syntaxes; 2–4 are the comma form, 5–7 the space form.
  const [r, g, b, a] = [
    match[1],
    match[2] ?? match[5],
    match[3] ?? match[6],
    match[4] ?? match[7],
  ];
  const channels = [r, g, b].map(Number);
  if (channels.some((c) => !(c >= 0 && c <= 255))) return null;
  let alpha = 1;
  if (a !== undefined) {
    alpha = a.endsWith("%") ? Number(a.slice(0, -1)) / 100 : Number(a);
    if (!(alpha >= 0 && alpha <= 1)) return null;
  }
  return [channels[0]!, channels[1]!, channels[2]!, alpha];
}

/** Whether a value is a hex or rgb color, the only formats every SDK and the support chat accept. */
export function isSupportedColor(input: unknown): input is string {
  return parseColor(input) !== null;
}

export function formatHex([r, g, b, a]: Rgba): string {
  const hex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ""}`;
}

/** Blends `amount` (0–1) of `toward` into `color`. Null if either color can't be parsed. */
export function mixColors(
  color: string,
  toward: string,
  amount: number,
): string | null {
  const a = parseColor(color);
  const b = parseColor(toward);
  if (!a || !b) return null;
  const t = Math.min(1, Math.max(0, amount));
  return formatHex([
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ]);
}

/** The color at the given opacity. Null if it can't be parsed. */
export function withAlpha(color: string, alpha: number): string | null {
  const c = parseColor(color);
  return c ? formatHex([c[0], c[1], c[2], c[3] * alpha]) : null;
}

function luminance([r, g, b]: Rgba): number {
  const linear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two opaque colors (1–21). Null if either can't be parsed. */
export function contrastRatio(a: string, b: string): number | null {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return null;
  const [hi, lo] = [luminance(x), luminance(y)].sort((m, n) => n - m) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const ON_ACCENT_LIGHT = "#ffffff";
const ON_ACCENT_DARK = "#1a1915";

/**
 * Text color for a filled accent surface. White while it keeps at least 3:1
 * contrast (WCAG's bar for bold UI text), otherwise whichever of white or
 * near-black reads better. Unparseable accents get white, as before.
 */
export function readableTextOn(background: string): string {
  const white = contrastRatio(background, ON_ACCENT_LIGHT);
  if (white === null || white >= 3) return ON_ACCENT_LIGHT;
  const dark = contrastRatio(background, ON_ACCENT_DARK) ?? 0;
  return dark > white ? ON_ACCENT_DARK : ON_ACCENT_LIGHT;
}

/** Clamps a radius to 0–32 px. Missing or invalid values give the default. */
export function clampRadius(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    !Number.isFinite(n)
  )
    return DEFAULT_RADIUS;
  return Math.round(Math.min(MAX_RADIUS, Math.max(0, n)));
}

/** Scales one of the widget's built-in radii (designed for the 12 px default) to the chosen radius. */
export function scaleRadius(designed: number, radius: number): number {
  return Math.round((designed * radius) / DEFAULT_RADIUS);
}

const COLOR_KEYS: (keyof UpstepThemeColors)[] = [
  "background",
  "surface",
  "border",
  "text",
  "textMuted",
  "accentText",
];

/**
 * Flattens `colors` for one mode: top-level keys, then that mode's keys on top.
 * Empty or non-string values are dropped so they fall back to the defaults.
 */
export function resolveColorOverrides(
  colors: UpstepColorOverrides | undefined,
  mode: "light" | "dark",
): Partial<UpstepThemeColors> {
  const out: Partial<UpstepThemeColors> = {};
  if (!colors) return out;
  for (const source of [colors, colors[mode]]) {
    if (!source) continue;
    for (const key of COLOR_KEYS) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
  }
  return out;
}

/** The web widget's palette. */
export interface WidgetPalette {
  dark: boolean;
  bg: string;
  bgSoft: string;
  bgHover: string;
  text: string;
  textSoft: string;
  textFaint: string;
  border: string;
  overlay: string;
  accent: string;
  accentText: string;
  /** Accent at low opacity, for selected/voted fills. */
  accentTint: string;
  radius: number;
}

const LIGHT = {
  bg: "#ffffff",
  bgSoft: "#f5f5f5",
  bgHover: "#ededed",
  text: "#1a1915",
  textSoft: "#56544d",
  textFaint: "#9b9890",
  border: "#e8e6df",
  overlay: "rgba(26,25,21,.45)",
};

const DARK = {
  bg: "#000000",
  bgSoft: "#171717",
  bgHover: "#262626",
  text: "#f5f4f0",
  textSoft: "#b4b1a8",
  textFaint: "#7d7a72",
  border: "#33312c",
  overlay: "rgba(0,0,0,.6)",
};

/** Blend for the web: exact hex when both colors parse, CSS color-mix() otherwise. */
function cssMix(color: string, toward: string, amount: number) {
  return (
    mixColors(color, toward, amount) ??
    `color-mix(in srgb, ${color} ${Math.round((1 - amount) * 100)}%, ${toward})`
  );
}

/** Builds the web widget palette: defaults for the mode, then any overrides. */
export function buildWidgetPalette(options: {
  mode: "light" | "dark";
  accentColor?: string | undefined;
  colors?: UpstepColorOverrides | undefined;
  radius?: number | undefined;
}): WidgetPalette {
  const base = options.mode === "dark" ? DARK : LIGHT;
  const o = resolveColorOverrides(options.colors, options.mode);
  const accent = options.accentColor?.trim() || defaultAccent(options.mode);
  const bg = o.background ?? base.bg;
  const text = o.text ?? base.text;
  const bgSoft = o.surface ?? base.bgSoft;
  return {
    dark: options.mode === "dark",
    bg,
    bgSoft,
    bgHover: o.surface || o.text ? cssMix(bgSoft, text, 0.06) : base.bgHover,
    text,
    textSoft: o.textMuted ?? base.textSoft,
    textFaint:
      o.textMuted || o.background
        ? cssMix(o.textMuted ?? base.textSoft, bg, 0.4)
        : base.textFaint,
    border: o.border ?? base.border,
    overlay: base.overlay,
    accent,
    accentText: o.accentText ?? readableTextOn(accent),
    accentTint:
      withAlpha(accent, 0.1) ??
      `color-mix(in srgb, ${accent} 10%, transparent)`,
    radius: clampRadius(options.radius),
  };
}

/**
 * Query parameters for the hosted support chat. Only hex/rgb colors are
 * sent, and only the keys that were overridden, so the chat keeps its own
 * defaults for the rest.
 */
export function supportThemeParams(options: {
  mode: "light" | "dark";
  colors?: UpstepColorOverrides | undefined;
  radius?: number | undefined;
  fontFamily?: string | undefined;
}): Record<string, string> {
  const o = resolveColorOverrides(options.colors, options.mode);
  const params: Record<string, string> = {};
  const names: Record<keyof UpstepThemeColors, string> = {
    background: "bg",
    surface: "surface",
    border: "border",
    text: "text",
    textMuted: "muted",
    accentText: "accentText",
  };
  for (const key of COLOR_KEYS) {
    const value = o[key];
    if (isSupportedColor(value)) params[names[key]] = value;
  }
  if (options.radius !== undefined)
    params["radius"] = String(clampRadius(options.radius));
  if (options.fontFamily?.trim()) params["font"] = options.fontFamily.trim();
  return params;
}
