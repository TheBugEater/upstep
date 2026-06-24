"use client";

import { useState, useTransition } from "react";
import type { TeamMember } from "@/components/dashboard/ProjectTabs";

interface Props {
  projectId: string;
  apiKey: string;
  moderationEnabled: boolean;
  isOwner: boolean;
  teamMembers: TeamMember[];
}

export function SettingsTab({
  projectId,
  apiKey: initialKey,
  moderationEnabled,
  isOwner,
  teamMembers: initialMembers,
}: Props) {
  // ── API key ──────────────────────────────────────────────────────────────────
  const [key, setKey] = useState(initialKey);
  const [rotating, startRotate] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedNew, setCopiedNew] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);

  // ── Moderation ───────────────────────────────────────────────────────────────
  const [modOn, setModOn] = useState(moderationEnabled);
  const [modPending, startMod] = useTransition();

  // ── Team ─────────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  async function rotateKey() {
    startRotate(async () => {
      const res = await fetch(`/api/projects/${projectId}/rotate-key`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { apiKey: string };
        setKey(data.apiKey);
        setNewKey(data.apiKey);
        setConfirmRotate(false);
      }
    });
  }

  async function copyKey() {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyNewKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopiedNew(true);
    setTimeout(() => setCopiedNew(false), 2000);
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

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json()) as { error?: string; user: { id: string; name: string | null; email: string } };
      if (!res.ok) {
        setInviteError((data as { error?: string }).error ?? "Failed to add member.");
      } else {
        const newMember: TeamMember = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: "MEMBER",
        };
        setMembers((prev) => [...prev, newMember]);
        setInviteEmail("");
      }
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    setRemoving(userId);
    try {
      await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } finally {
      setRemoving(null);
    }
  }

  const maskedKey = key.slice(0, 12) + "•".repeat(Math.max(0, key.length - 12));

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── Team ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
        <h3 className="text-sm font-semibold text-ink mb-1">Team</h3>
        <p className="text-xs text-muted mb-5">
          Members can view and triage all feedback. Only the owner can change project settings.
        </p>

        <div className="space-y-2 mb-5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-clay/10 text-clay flex items-center justify-center text-xs font-semibold shrink-0">
                {(m.name ?? m.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {m.name && <p className="text-sm font-medium text-ink truncate">{m.name}</p>}
                <p className={`text-xs truncate ${m.name ? "text-muted" : "text-ink font-medium"}`}>{m.email}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                m.role === "OWNER"
                  ? "text-clay bg-clay/5 border-clay/20"
                  : "text-muted bg-surface border-line"
              }`}>
                {m.role === "OWNER" ? "Owner" : "Member"}
              </span>
              {isOwner && m.role !== "OWNER" && (
                <button
                  onClick={() => void removeMember(m.id)}
                  disabled={removing === m.id}
                  className="text-xs text-faint hover:text-red-500 transition disabled:opacity-40 shrink-0"
                  aria-label={`Remove ${m.email}`}
                >
                  {removing === m.id ? "…" : "✕"}
                </button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <form onSubmit={(e) => void inviteMember(e)} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
              placeholder="teammate@company.com"
              className="flex-1 text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40 shrink-0"
            >
              {inviting ? "Adding…" : "Add"}
            </button>
          </form>
        )}
        {inviteError && <p className="text-xs text-red-500 mt-2">{inviteError}</p>}
      </div>

      {/* ── API Key (owner only) ─────────────────────────────────────────────── */}
      {isOwner && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <h3 className="text-sm font-semibold text-ink mb-1">API Key</h3>
          <p className="text-xs text-muted mb-4">
            Used in your SDK to authorise writes to this project. The key is masked for security —
            copy it when you need to use it.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 text-xs font-mono bg-surface border border-line rounded-xl px-4 py-3 text-ink-soft truncate">
              {maskedKey}
            </code>
            <button
              onClick={() => void copyKey()}
              className="text-xs px-3 py-2 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition shrink-0"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

          {newKey && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">
                Save your new key. This is the only time it will be shown in full.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border border-amber-200 rounded-lg px-3 py-2 text-ink break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => void copyNewKey()}
                  className="text-xs px-3 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition shrink-0"
                >
                  {copiedNew ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-2 text-xs text-amber-600 hover:text-amber-800 transition"
              >
                I&apos;ve saved it, dismiss
              </button>
            </div>
          )}

          {confirmRotate ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
              <p className="text-xs text-red-700 flex-1">
                <strong>This cannot be undone.</strong> Your old key will stop working immediately.
                Any live apps using it will break until you update them.
              </p>
              <button
                onClick={() => void rotateKey()}
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
      )}

      {/* ── Moderation (owner only) ──────────────────────────────────────────── */}
      {isOwner && (
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
              onClick={() => void toggleMod()}
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
      )}

      {/* Non-owner info */}
      {!isOwner && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-5 text-center">
          <p className="text-sm text-muted">
            Project settings are managed by the owner.
          </p>
        </div>
      )}
    </div>
  );
}
