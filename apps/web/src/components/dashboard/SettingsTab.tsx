"use client";

import { useEffect, useState, useTransition } from "react";
import type { TeamMember } from "@/components/workspace/ProjectWorkspace";
import { Avatar } from "@/components/Avatar";

interface Props {
  projectId: string;
  apiKey: string;
  moderationEnabled: boolean;
  isOwner: boolean;
  canManage: boolean;
  currentUserId: string;
  teamMembers: TeamMember[];
  onTeamChange: (members: TeamMember[]) => void;
}

type PendingInvitation = { id: string; email: string; expiresAt: string; lastSentAt: string; createdAt: string };
type InviteResponse = { error?: string; emailQueued?: boolean; alreadyMember?: boolean; invitation?: PendingInvitation | null };

export function SettingsTab({
  projectId,
  apiKey: initialKey,
  moderationEnabled,
  isOwner,
  canManage,
  currentUserId,
  onTeamChange,
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
  const [inviteNotice, setInviteNotice] = useState("");
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(canManage);
  const [invitationAction, setInvitationAction] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage) return;
    const controller = new AbortController();
    void fetch(`/api/projects/${projectId}/invitations`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Couldn't load pending invitations.");
        setInvitations(await res.json() as PendingInvitation[]);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPendingError(error instanceof Error ? error.message : "Couldn't load pending invitations.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingInvitations(false); });
    return () => controller.abort();
  }, [canManage, projectId]);

  function updateInvitation(invitation: PendingInvitation) {
    setInvitations((previous) => [...previous.filter((item) => item.id !== invitation.id), invitation]);
  }

  async function manageInvitation(id: string, action: "resend" | "revoke") {
    setInvitationAction(id);
    setInviteError("");
    setInviteNotice("");
    try {
      const url = `/api/projects/${projectId}/invitations/${id}${action === "resend" ? "/resend" : ""}`;
      const res = await fetch(url, { method: action === "resend" ? "POST" : "DELETE" });
      const data = await res.json() as InviteResponse;
      if (!res.ok) throw new Error(data.error || "Couldn't update this invitation.");
      if (action === "revoke" || data.alreadyMember) {
        setInvitations((previous) => previous.filter((item) => item.id !== id));
      } else if (data.invitation) updateInvitation(data.invitation);
      setInviteNotice(action === "revoke" ? "Invitation revoked." : data.alreadyMember ? "This teammate has already joined."
        : data.emailQueued ? "Invitation email queued. The previous link no longer works." : "An invitation is already pending. Try again shortly if you need a new link.");
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Couldn't update this invitation.");
    } finally {
      setInvitationAction(null);
    }
  }

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
    setInviteNotice("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json()) as InviteResponse;
      if (!res.ok) {
        setInviteError((data as { error?: string }).error ?? "Failed to add member.");
      } else {
        if (data.invitation) updateInvitation(data.invitation);
        setInviteNotice(data.alreadyMember ? "This teammate already has access to this project."
          : data.emailQueued ? "Invitation email queued. They can create an account when they accept."
          : "An invitation is already pending for this email. Use Resend below if needed.");
        setInviteEmail("");
      }
    } catch {
      setInviteError("Couldn't add this teammate. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    setRemoving(userId);
    setInviteError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove this teammate.");
      const next = members.filter((m) => m.id !== userId);
      setMembers(next);
      onTeamChange(next);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Couldn't remove this teammate.");
    } finally {
      setRemoving(null);
    }
  }

  async function changeRole(userId: string, role: "ADMIN" | "MEMBER") {
    setChangingRole(userId);
    setInviteError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      if (!res.ok) throw new Error("Couldn't change this teammate's role.");
      const next = members.map((m) => m.id === userId ? { ...m, role } : m);
      setMembers(next);
      onTeamChange(next);
      setInviteNotice(`Role changed to ${role === "ADMIN" ? "Admin" : "Member"}.`);
    } catch (error) { setInviteError(error instanceof Error ? error.message : "Couldn't change this teammate's role."); }
    finally { setChangingRole(null); }
  }

  const maskedKey = key.slice(0, 12) + "•".repeat(Math.max(0, key.length - 12));

  return (
    <div className="space-y-6 max-w-xl">

      {/* ── Team ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
        <h3 className="text-sm font-semibold text-ink mb-1">Team</h3>
        <p className="text-xs text-muted mb-5">
          Members can view, comment on and assign tasks. Admins also manage project settings, integrations and invitations. Only the owner can change roles or rotate keys.
        </p>

        <div className="space-y-2 mb-5">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar name={m.name} email={m.email} src={m.image} size={32} tone="accent" decorative />
              <div className="flex-1 min-w-0">
                {m.name && <p className="text-sm font-medium text-ink truncate">{m.name}</p>}
                <p className={`text-xs truncate ${m.name ? "text-muted" : "text-ink font-medium"}`}>{m.email}</p>
              </div>
              {isOwner && m.role !== "OWNER" ? <select aria-label={`Role for ${m.name || m.email}`} value={m.role} disabled={!!changingRole} onChange={(e) => void changeRole(m.id, e.target.value as "ADMIN" | "MEMBER")} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink disabled:opacity-40"><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select> : <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                m.role === "OWNER"
                  ? "text-clay bg-clay/5 border-clay/20"
                  : "text-muted bg-surface border-line"
              }`}>
                {m.role === "OWNER" ? "Owner" : m.role === "ADMIN" ? "Admin" : "Member"}
              </span>}
              {canManage && m.role !== "OWNER" && (isOwner || m.role === "MEMBER") && m.id !== currentUserId && (
                <button
                  onClick={() => void removeMember(m.id)}
                  disabled={removing === m.id}
                  className="text-xs text-faint hover:text-danger transition disabled:opacity-40 shrink-0"
                  aria-label={`Remove ${m.email}`}
                >
                  {removing === m.id ? "…" : "✕"}
                </button>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <form onSubmit={(e) => void inviteMember(e)} className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); setInviteNotice(""); }}
              placeholder="teammate@company.com"
              className="flex-1 text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
            />
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-fg text-sm font-medium hover:bg-primary/85 transition disabled:opacity-40 shrink-0"
            >
              {inviting ? "Sending…" : "Invite"}
            </button>
          </form>
        )}
        {inviteError && <p className="text-xs text-danger mt-2">{inviteError}</p>}
        {inviteNotice && <p className="text-xs text-muted mt-2" role="status">{inviteNotice}</p>}
        {canManage && <p className="text-xs text-faint mt-3">Invite any email address. They can create an account when accepting. Invitations expire after seven days.</p>}
        {canManage && <div className="mt-6 border-t border-line pt-5">
          <h4 className="text-xs font-semibold text-ink mb-3">Pending invitations</h4>
          {loadingInvitations && <p className="text-xs text-muted">Loading invitations…</p>}
          {pendingError && <p className="text-xs text-danger" role="alert">{pendingError}</p>}
          {!loadingInvitations && !pendingError && invitations.length === 0 && <p className="text-xs text-faint">No pending invitations.</p>}
          <div className="space-y-3">{invitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink truncate">{invitation.email}</p>
                <p className="text-[11px] text-faint">{new Date(invitation.expiresAt) <= new Date() ? "Expired" : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}</p>
              </div>
              <button type="button" disabled={!!invitationAction} onClick={() => void manageInvitation(invitation.id, "resend")} className="text-xs text-muted hover:text-ink disabled:opacity-40">{invitationAction === invitation.id ? "Updating…" : "Resend"}</button>
              <button type="button" disabled={!!invitationAction} onClick={() => void manageInvitation(invitation.id, "revoke")} className="text-xs text-muted hover:text-danger disabled:opacity-40">Revoke</button>
            </div>
          ))}</div>
        </div>}
      </div>

      {/* ── API Key (owner only) ─────────────────────────────────────────────── */}
      {isOwner && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <h3 className="text-sm font-semibold text-ink mb-1">Publishable SDK key</h3>
          <p className="text-xs text-muted mb-4">
            Used by browser and mobile SDKs to submit public feedback. This key identifies the project and is safe to embed in client applications; it never grants dashboard or MCP access.
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
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 mb-4">
              <p className="text-xs font-semibold text-warning mb-2">
                Update every installed SDK with this new publishable key.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border border-warning/30 rounded-lg px-3 py-2 text-ink break-all">
                  {newKey}
                </code>
                <button
                  onClick={() => void copyNewKey()}
                  className="text-xs px-3 py-2 rounded-lg bg-warning text-white font-medium hover:bg-warning/85 transition shrink-0"
                >
                  {copiedNew ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-2 text-xs text-warning hover:text-warning transition"
              >
                I&apos;ve saved it, dismiss
              </button>
            </div>
          )}

          {confirmRotate ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/25">
              <p className="text-xs text-danger flex-1">
                <strong>This cannot be undone.</strong> Your old key will stop working immediately.
                Any live apps using it will break until you update them.
              </p>
              <button
                onClick={() => void rotateKey()}
                disabled={rotating}
                className="text-xs px-4 py-2 rounded-lg bg-danger text-white font-semibold hover:bg-danger/85 transition disabled:opacity-60 shrink-0"
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
              className="text-xs px-4 py-2 rounded-xl border border-line text-muted hover:text-danger hover:border-danger/30 transition font-medium"
            >
              Rotate key…
            </button>
          )}
        </div>
      )}

      {/* ── Moderation (owner only) ──────────────────────────────────────────── */}
      {canManage && (
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
      {!canManage && (
        <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-5 text-center">
          <p className="text-sm text-muted">
            Project settings are managed by the owner and admins.
          </p>
        </div>
      )}
    </div>
  );
}
