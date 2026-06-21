"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (data.code === "PROJECT_LIMIT") {
        setLimitHit(true);
        setError(data.error ?? "You've reached your project limit.");
      } else {
        setError(typeof data.error === "string" ? data.error : "Failed to create project.");
      }
      setLoading(false);
      return;
    }

    const project = (await res.json()) as { id: string; apiKey: string };
    setCreated(project);
    setLoading(false);
  }

  async function copyKey() {
    if (!created) return;
    await navigator.clipboard.writeText(created.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="border-b border-line bg-canvas/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
            <Logo href="/dashboard" />
          </div>
        </header>

        <div className="max-w-lg mx-auto px-6 py-12">
          <div className="w-11 h-11 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-lg mb-5">
            ✓
          </div>
          <h1 className="font-serif text-3xl tracking-tight text-ink">Save your API key</h1>
          <p className="text-sm text-muted mt-2">
            This is the only time your key will be shown in full. Copy it now and store it
            somewhere safe — your password manager, <code className="font-mono text-xs bg-surface border border-line rounded px-1 py-0.5">.env</code> file, or secrets manager.
          </p>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
              Your API key — copy it now
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white border border-amber-200 rounded-xl px-4 py-3 text-ink break-all">
                {created.apiKey}
              </code>
              <button
                onClick={copyKey}
                className="text-sm px-4 py-3 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 transition shrink-0"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-3">
              After you leave this page, the key will always be masked in Settings. You can rotate it there if needed.
            </p>
          </div>

          <button
            onClick={() => router.push(`/dashboard/projects/${created.id}`)}
            className="mt-6 w-full py-3 bg-clay text-white rounded-xl font-medium text-sm hover:bg-clay-hover transition shadow-soft"
          >
            Go to project →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Logo href="/dashboard" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-12">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-ink transition inline-flex items-center gap-1.5 mb-8"
        >
          ← All projects
        </Link>

        <div className="w-11 h-11 rounded-xl bg-clay/10 text-clay flex items-center justify-center text-lg mb-5">
          ✦
        </div>
        <h1 className="font-serif text-3xl tracking-tight text-ink">New project</h1>
        <p className="text-sm text-muted mt-2">
          Name your app and you&apos;ll get a unique API key to drop into your SDK.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-soft mb-2">
              Project name
            </label>
            <input
              type="text"
              placeholder="e.g. My iOS App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={80}
              className="w-full px-4 py-3 bg-card border border-line rounded-xl text-sm text-ink placeholder-faint focus:outline-none focus:border-clay focus:ring-4 focus:ring-clay/10 transition"
            />
          </div>

          {error && !limitHit && <p className="text-red-500 text-sm">{error}</p>}

          {limitHit ? (
            <div className="rounded-xl border border-clay/30 bg-clay-tint px-4 py-4">
              <p className="text-sm text-ink-soft">{error}</p>
              <Link
                href="/dashboard/billing"
                className="mt-3 inline-flex items-center gap-2 bg-clay text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-clay-hover transition"
              >
                View plans →
              </Link>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full py-3 bg-clay text-white rounded-xl font-medium text-sm hover:bg-clay-hover transition disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
            >
              {loading ? "Creating…" : "Create project"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
