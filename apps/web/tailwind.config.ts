import type { Config } from "tailwindcss";

/** All colors resolve through CSS variables (RGB triplets) declared in
 *  globals.css, so light/dark theming is a class flip on <html>. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: v("c-canvas"),
        surface: v("c-surface"),
        card: v("c-card"),
        line: v("c-line"),
        "line-strong": v("c-line-strong"),
        ink: v("c-ink"),
        "ink-soft": v("c-ink-soft"),
        muted: v("c-muted"),
        faint: v("c-faint"),
        clay: {
          DEFAULT: v("c-clay"),
          hover: v("c-clay-hover"),
          dark: v("c-clay-dark"),
          tint: v("c-clay-tint"),
          tint2: v("c-clay-tint2"),
        },
        // High-contrast action color: near-black in light mode, cream in dark.
        primary: {
          DEFAULT: v("c-primary"),
          fg: v("c-primary-fg"),
        },
        success: v("c-success"),
        warning: v("c-warning"),
        danger: v("c-danger"),
        info: v("c-info"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        glow: "0 0 0 1px rgb(var(--c-clay) / 0.25), 0 8px 32px rgb(var(--c-clay) / 0.18)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "card-in": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
        "drop-settle": {
          "0%": { transform: "scale(1.03)", boxShadow: "var(--shadow-lift)" },
          "100%": { transform: "scale(1)", boxShadow: "var(--shadow-soft)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.8s ease both",
        "card-in": "card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both",
        pop: "pop 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        "drop-settle": "drop-settle 0.3s cubic-bezier(0.32,0.72,0,1)",
        blink: "blink 1s step-end infinite",
        "pulse-ring": "pulse-ring 1.2s cubic-bezier(0.16,1,0.3,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
