"use client";

import { useState, useTransition } from "react";

interface Props {
  projectId: string;
  apiKey: string;
  moderationEnabled: boolean;
}

export function SettingsTab({ projectId, apiKey: initialKey, moderationEnabled }: Props) {
  const [key, setKey] = useState(initialKey);
  const [revealed, setRevealed] = useState(false);
  const [rotating, startRotate] = useTransition();
  const [rotated, setRotated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const [modOn, setModOn] = useState(moderationEnabled);
  const [modPending, startMod] = useTransition();

  async function rotateKey() {
    startRotate(async () => {
      const res = await fetch(`/api/projects/${projectId}/rotate-key`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { apiKey: string };
        setKey(data.apiKey);
        setRevealed(true);
        setRotated(true);
        setConfirmRotate(false);
      }
    });
  }

  async function copyKey() {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function toggleMod() {
    const next = !modOn;
    setModOn(next);
    startMod(async () => {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderationEnabled: next }),
      });
    });
  }

  const maskedKey = key.slice(0, 8) + "•".repeat(Math.max(0, key.length - 8));

  return (
    <div className="space-y-6 max-w-xl">
      {/* API Key card */}
      <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
        <h3 className="text-sm font-semibold text-ink mb-1">API Key</h3>
        <p className="text-xs text-muted mb-4">
          Used in your SDK to send feedback to this project. Keep it secret — it authorises
          writes on your behalf.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 text-xs font-mono bg-surface border border-line rounded-xl px-4 py-3 text-ink-soft truncate">
            {revealed ? key : maskedKey}
          </code>
          <button
            onClick={() => setRevealed((v) => !v)}
            className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition shrink-0"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
          <button
            onClick={copyKey}
            className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition shrink-0"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {rotated && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-4">
            Key rotated — update your SDK config with the new key above. The old key is now
            invalid.
          </div>
        )}

        {confirmRotate ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
            <p className="text-xs text-red-700 flex-1">
              <strong>This cannot be undone.</strong> Your old key will stop working immediately.
              Any live apps using it will break until you update them.
            </p>
            <button
              onClick={rotateKey}
              disabled={rotating}
              className="text-xs px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-60 shrink-0"
            >
              {rotating ? "Rotating…" : "Confirm rotate"}
            </button>
            <button
              onClick={() => setConfirmRotate(false)}
              className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink transition shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRotate(true)}
            className="text-xs px-4 py-2 rounded-xl border border-line text-muted hover:text-red-600 hover:border-red-200 transition font-medium"
          >
            Rotate key…
          </button>
        )}
      </div>

      {/* Moderation toggle */}
      <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-sm font-semibold text-ink mb-1">Hold feedback for review</h3>
            <p className="text-xs text-muted">
              {modOn
                ? "New submissions arrive as Pending and won't appear publicly until you approve them."
                : "New submissions go live immediately as Open."}
            </p>
          </div>
          <button
            onClick={toggleMod}
            disabled={modPending}
            aria-pressed={modOn}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 mt-0.5 ${
              modOn ? "bg-clay" : "bg-line-strong"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                modOn ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
