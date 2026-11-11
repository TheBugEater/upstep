import { createContext, useContext, useMemo } from "react";
import type { UpstepColorOverrides } from "@upstep/types";
import {
  DEFAULT_RADIUS,
  clampRadius,
  mixColors,
  readableTextOn,
  resolveColorOverrides,
  scaleRadius,
} from "@upstep/js/theme";

export { readableTextOn, clampRadius, DEFAULT_RADIUS };

/** Base corner radius for everything under it. FeedbackProvider and SupportView set it. */
export const RadiusContext = createContext(DEFAULT_RADIUS);

type StyleMap = Record<string, Record<string, unknown>>;

/**
 * Scales every corner radius in a stylesheet to the chosen base radius.
 * Circles (dots, avatars: radius at least half their size) stay round.
 * The default radius returns the stylesheet untouched.
 */
export function scaleRadii<T extends StyleMap>(styles: T, radius: number): T {
  if (radius === DEFAULT_RADIUS) return styles;
  const out: StyleMap = {};
  for (const [name, style] of Object.entries(styles)) {
    const r = style["borderRadius"];
    const size = Math.min(
      typeof style["width"] === "number" ? style["width"] : Infinity,
      typeof style["height"] === "number" ? style["height"] : Infinity,
    );
    out[name] =
      typeof r === "number" && r * 2 < size
        ? { ...style, borderRadius: scaleRadius(r, radius) }
        : style;
  }
  return out as T;
}

/** The stylesheet with radii scaled to the nearest RadiusContext. */
export function useScaledStyles<T extends StyleMap>(styles: T): T {
  const radius = useContext(RadiusContext);
  return useMemo(() => scaleRadii(styles, radius), [styles, radius]);
}

/** Feedback sheet palette. */
export interface SheetPalette {
  bg: string;
  bgSoft: string;
  text: string;
  textSoft: string;
  textFaint: string;
  border: string;
  handle: string;
  accentText: string;
}

const SHEET_LIGHT = {
  bg: "#ffffff",
  bgSoft: "#f5f5f5",
  text: "#1a1915",
  textSoft: "#56544d",
  textFaint: "#9b9890",
  border: "#e8e6df",
  handle: "#dad7ce",
};

const SHEET_DARK = {
  bg: "#000000",
  bgSoft: "#171717",
  text: "#f5f4f0",
  textSoft: "#b4b1a8",
  textFaint: "#7d7a72",
  border: "#33312c",
  handle: "#48453f",
};

export function sheetPalette(
  dark: boolean,
  accent: string,
  colors: UpstepColorOverrides | undefined,
): SheetPalette {
  const base = dark ? SHEET_DARK : SHEET_LIGHT;
  const o = resolveColorOverrides(colors, dark ? "dark" : "light");
  const bg = o.background ?? base.bg;
  const text = o.text ?? base.text;
  const border = o.border ?? base.border;
  return {
    bg,
    bgSoft: o.surface ?? base.bgSoft,
    text,
    textSoft: o.textMuted ?? base.textSoft,
    textFaint:
      o.textMuted || o.background
        ? (mixColors(o.textMuted ?? base.textSoft, bg, 0.4) ?? base.textFaint)
        : base.textFaint,
    border,
    handle:
      o.border || o.text
        ? (mixColors(border, text, 0.12) ?? base.handle)
        : base.handle,
    accentText: o.accentText ?? readableTextOn(accent),
  };
}

/** Support chat palette before accent tints are added. */
export function supportBaseColors(
  dark: boolean,
  accent: string,
  colors: UpstepColorOverrides | undefined,
) {
  const o = resolveColorOverrides(colors, dark ? "dark" : "light");
  const bg = o.background ?? (dark ? "#000000" : "#ffffff");
  return {
    bg,
    soft: o.surface ?? (dark ? "#1b1b1b" : "#f2f2f2"),
    text: o.text ?? (dark ? "#ececec" : "#262626"),
    muted: o.textMuted ?? (dark ? "#a3a3a3" : "#6b6b6b"),
    line: o.border ?? (dark ? "#333333" : "#e5e5e5"),
    ink: o.text ?? (dark ? "#f2f2f2" : "#171717"),
    onInk: o.text ? bg : dark ? "#111111" : "#ffffff",
    accentText: o.accentText ?? readableTextOn(accent),
    /** What accent-colored text is mixed toward so it reads on the background. */
    inkTarget: o.text ?? (dark ? "#ffffff" : "#171717"),
  };
}
