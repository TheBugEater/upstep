"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useOnRamp } from "@onramp-sdk/react";

export default function NewProjectPage() {
  const router = useRouter();
  const { step } = useOnRamp();
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
        step("project_limit_hit");
        setLimitHit(true);
        setError(data.error ?? "You've reached your project limit.");
      } else {
        setError(typeof data.error === "string" ? data.error : "Failed to create project.");
      }
      setLoading(false);
      return;
    }

    const project = (await res.json()) as { id: string; apiKey: string };
    step("project_created");
    setCreated(project);
    setLoading(false);
  }

  async function copyKey() {
    if (!created) return;
    await navigator.clipboard.writeText(created.apiKey);
    step("api_key_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-lg text-success">
            ✓
          </div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Project created</div>
          <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">Add your publishable key</h1>
          <p className="text-sm text-muted mt-2">
            Put this key in your browser or mobile SDK configuration. It identifies the project and is safe to ship in a client application; it does not grant dashboard or MCP access.
          </p>

          <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/10 p-5 shadow-soft">
            <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-3">
              Publishable SDK key
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white border border-warning/30 rounded-xl px-4 py-3 text-ink break-all">
                {created.apiKey}
              </code>
              <button
                onClick={copyKey}
                className="text-sm px-4 py-3 rounded-xl bg-warning text-white font-medium hover:bg-warning/85 transition shrink-0"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-warning mt-3">
              You can copy or rotate this key later from Project settings.
            </p>
          </div>

          <button
            onClick={() => {
              router.push(`/dashboard/projects/${created.id}`);
              router.refresh();
            }}
            className="mt-6 w-full py-3 bg-clay text-white rounded-xl font-medium text-sm hover:bg-clay-hover transition shadow-soft"
          >
            Go to project →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-xl">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-ink transition inline-flex items-center gap-1.5 mb-8"
        >
          ← All projects
        </Link>

        <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-clay/10 text-lg text-clay">
          ✦
        </div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Workspace setup</div>
        <h1 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">Create a project</h1>
        <p className="text-sm text-muted mt-2">
          Name your app and you&apos;ll get a unique API key to drop into your SDK.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-line bg-card p-5 shadow-soft sm:p-6">
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

          {error && !limitHit && <p className="text-danger text-sm">{error}</p>}

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
