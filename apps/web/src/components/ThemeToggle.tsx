"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("upstep:theme", theme);
}

/** Sun/moon toggle. The initial class is set pre-paint by the inline script
 *  in the root layout; this component only flips it afterwards. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={`relative flex items-center justify-center w-9 h-9 rounded-full border border-line bg-card text-muted hover:text-ink hover:border-line-strong transition ${className}`}
    >
      {/* Render both icons and cross-fade so there's no hydration flash */}
      <span
        aria-hidden
        className={`absolute transition-all duration-300 ease-fluid ${
          theme === "dark" ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        }`}
      >
        <SunIcon />
      </span>
      <span
        aria-hidden
        className={`absolute transition-all duration-300 ease-fluid ${
          theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
        }`}
      >
        <MoonIcon />
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.5 0.5v2M7.5 12.5v2M0.5 7.5h2M12.5 7.5h2M2.55 2.55l1.4 1.4M11.05 11.05l1.4 1.4M12.45 2.55l-1.4 1.4M3.95 11.05l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M13 9.5A6 6 0 0 1 5.5 2 6 6 0 1 0 13 9.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
