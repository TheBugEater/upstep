import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm paper canvas
        canvas: "#FAF9F7",
        surface: "#F5F4EE",
        card: "#FFFFFF",
        // Hairline borders
        line: "#E8E6DF",
        "line-strong": "#DAD7CE",
        // Ink (warm near-black -> muted)
        ink: "#1A1915",
        "ink-soft": "#3D3B35",
        muted: "#6B6860",
        faint: "#9B9890",
        // Clay accent (Claude orange)
        clay: {
          DEFAULT: "#D97757",
          hover: "#C4654A",
          dark: "#B0543B",
          tint: "#FDF0EB",
          tint2: "#FAE4D9",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26,25,21,0.04), 0 4px 16px rgba(26,25,21,0.04)",
        lift: "0 2px 4px rgba(26,25,21,0.05), 0 12px 32px rgba(26,25,21,0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
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
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.8s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
