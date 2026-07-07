"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { buildWidgetScript, type WidgetConfig } from "./generate";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WidgetGenerator() {
  const [buttonText, setButtonText] = useState("Feedback");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState<WidgetConfig["position"]>("bottom-right");
  const [accentColor, setAccentColor] = useState("#E05A33");

  const emailValid = EMAIL_RE.test(email);

  const snippet = useMemo(
    () => buildWidgetScript({ buttonText, email, position, accentColor }),
    [buttonText, email, position, accentColor],
  );

  const previewDoc = useMemo(() => {
    const previewSnippet = buildWidgetScript({
      buttonText,
      email: email || "you@example.com",
      position,
      accentColor,
    });
    return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font-family:-apple-system,sans-serif;color:#888;display:flex;align-items:center;justify-content:center;height:100vh;font-size:13px;">Your page content${previewSnippet}</body></html>`;
  }, [buttonText, email, position, accentColor]);

  return (
    <div className="rounded-2xl border border-line bg-card shadow-soft p-6 space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Button text</span>
          <input
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            maxLength={30}
            className="mt-1.5 w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-clay/50"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Send feedback to</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-clay/50"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Position</span>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as WidgetConfig["position"])}
            className="mt-1.5 w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-clay/50"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Accent color</span>
          <div className="mt-1.5 flex items-center gap-2 bg-surface border border-line rounded-lg px-3 py-1.5">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer bg-transparent"
            />
            <span className="text-sm text-muted font-mono">{accentColor}</span>
          </div>
        </label>
      </div>

      <div>
        <span className="text-xs font-semibold text-faint uppercase tracking-wide">Live preview</span>
        <div className="mt-1.5 rounded-xl border border-line overflow-hidden h-64 bg-surface">
          <iframe
            key={previewDoc}
            title="Widget preview"
            srcDoc={previewDoc}
            sandbox="allow-scripts allow-popups"
            className="w-full h-full"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-faint uppercase tracking-wide">Your snippet</span>
          <CopyButton value={snippet} />
        </div>
        {!emailValid && (
          <p className="text-xs text-warning mb-2">
            Add a valid email above — the copied snippet will send feedback there.
          </p>
        )}
        <pre className="rounded-xl border border-line-strong bg-[#1C1B19] px-4 py-4 text-[12px] leading-relaxed font-mono text-white/85 overflow-x-auto max-h-72">
          <code>{snippet}</code>
        </pre>
        <p className="text-xs text-faint mt-2">
          Paste this right before <code className="bg-surface border border-line rounded px-1">&lt;/body&gt;</code> on any page.
        </p>
      </div>
    </div>
  );
}
