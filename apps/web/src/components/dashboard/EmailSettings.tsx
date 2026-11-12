"use client";

import { useEffect, useRef, useState } from "react";

type Prefs = { newFeedback: boolean; assigned: boolean; comments: boolean; statusChanges: boolean };

const OPTIONS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "newFeedback", label: "New feedback", hint: "Someone sends feedback through your widget, including items waiting for review." },
  { key: "assigned", label: "Assigned to me", hint: "A teammate or agent assigns a task to you." },
  { key: "comments", label: "Comments on my tasks", hint: "Someone comments on a task assigned to you." },
  { key: "statusChanges", label: "Status changes on my tasks", hint: "A task assigned to you moves to another status." },
];

/** Each person's own choice of notification emails for this project. */
export function EmailSettings({ projectId }: { projectId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [error, setError] = useState("");
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/projects/${projectId}/email-preferences`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json() as { prefs: Prefs; email: string | null; emailEnabled: boolean };
        setPrefs(data.prefs);
        setEmail(data.email ?? "");
        setEmailEnabled(data.emailEnabled);
        // Links in emails open settings with ?panel=email.
        if (new URLSearchParams(window.location.search).get("panel") === "email") {
          requestAnimationFrame(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("Couldn't load your email settings."); });
    return () => controller.abort();
  }, [projectId]);

  async function toggle(key: keyof Prefs) {
    if (!prefs || saving) return;
    const previous = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/email-preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPrefs(previous);
      setError("Couldn't save that change. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section ref={section} id="email-settings" aria-labelledby="email-settings-heading" className="scroll-mt-6 rounded-2xl border border-line bg-card p-6 shadow-soft">
      <h3 id="email-settings-heading" className="mb-1 text-sm font-semibold text-ink">Email notifications</h3>
      <p className="mb-4 text-xs text-muted">
        Choose which emails you get for this project{email ? <> at <span className="font-medium text-ink-soft">{email}</span></> : null}. These settings are just for you; you never get emails about your own changes.
      </p>
      {!emailEnabled && <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-ink">Email sending isn&apos;t set up on this server yet, so nothing will be sent. Your choices are saved for when it is.</p>}
      {error && <p role="alert" className="mb-3 text-xs text-danger">{error}</p>}
      <ul className="divide-y divide-line">
        {OPTIONS.map((option) => {
          const on = prefs?.[option.key] ?? false;
          return (
            <li key={option.key} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p id={`email-${option.key}`} className="text-sm font-medium text-ink">{option.label}</p>
                <p className="mt-0.5 text-xs text-muted">{option.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`email-${option.key}`}
                disabled={!prefs || saving === option.key}
                onClick={() => void toggle(option.key)}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${on ? "border-primary bg-primary" : "border-line-strong bg-raised"}`}
              >
                <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full shadow-sm transition-transform ${on ? "translate-x-[22px] bg-primary-fg" : "translate-x-0.5 bg-faint"}`} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
