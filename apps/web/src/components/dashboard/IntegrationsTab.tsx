"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationType = "SLACK" | "DISCORD" | "WEBHOOK";
type IntegrationEvent = "NEW_FEEDBACK" | "STATUS_CHANGED" | "NEW_VOTE" | "NEW_COMMENT";

interface Integration {
  id: string;
  type: IntegrationType;
  name: string | null;
  webhookUrl: string;
  events: IntegrationEvent[];
  enabled: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
  isOwner: boolean;
  isPro: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTEGRATION_TYPES: { type: IntegrationType; label: string; description: string; placeholder: string; color: string; icon: string }[] = [
  {
    type: "SLACK",
    label: "Slack",
    description: "Post notifications to a Slack channel via an Incoming Webhook.",
    placeholder: "https://hooks.slack.com/services/…",
    color: "#4A154B",
    icon: "#",
  },
  {
    type: "DISCORD",
    label: "Discord",
    description: "Send messages to a Discord channel via a Webhook URL.",
    placeholder: "https://discord.com/api/webhooks/…",
    color: "#5865F2",
    icon: "D",
  },
  {
    type: "WEBHOOK",
    label: "Webhook",
    description: "POST a JSON payload to any URL — great for Zapier, n8n, or custom backends.",
    placeholder: "https://your-server.com/webhook",
    color: "#374151",
    icon: "⟐",
  },
];

const EVENT_LABELS: Record<IntegrationEvent, { label: string; description: string }> = {
  NEW_FEEDBACK:   { label: "New feedback",       description: "A user submits feedback" },
  STATUS_CHANGED: { label: "Status changed",     description: "Feedback status is updated" },
  NEW_VOTE:       { label: "New vote",           description: "Someone votes on feedback" },
  NEW_COMMENT:    { label: "New comment",        description: "A team member adds a comment" },
};

const ALL_EVENTS: IntegrationEvent[] = ["NEW_FEEDBACK", "STATUS_CHANGED", "NEW_VOTE", "NEW_COMMENT"];

// ─── Component ────────────────────────────────────────────────────────────────

export function IntegrationsTab({ projectId, isOwner, isPro }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);

  // Form state (shared between create and edit)
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<IntegrationEvent[]>(["NEW_FEEDBACK"]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Row actions
  const [deleting, setDeleting] = useState<string | null>(null);
  const [_toggling, startToggle] = useTransition();

  useEffect(() => {
    if (!isPro) return;
    fetch(`/api/projects/${projectId}/integrations`)
      .then((r) => r.json())
      .then((data: { integrations: Integration[] }) => setIntegrations(data.integrations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, isPro]);

  function openForm(type: IntegrationType) {
    setEditingIntegration(null);
    setSelectedType(type);
    setFormName("");
    setFormUrl("");
    setFormEvents(["NEW_FEEDBACK"]);
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(integration: Integration) {
    setShowForm(false);
    setSelectedType(null);
    setEditingIntegration(integration);
    setFormName(integration.name ?? "");
    setFormUrl(integration.webhookUrl);
    setFormEvents(integration.events);
    setFormError("");
  }

  function closeForm() {
    setShowForm(false);
    setSelectedType(null);
    setEditingIntegration(null);
    setFormError("");
  }

  function toggleEvent(event: IntegrationEvent) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  async function saveIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!editingIntegration && !selectedType) return;
    if (!formUrl.trim()) { setFormError("Webhook URL is required."); return; }
    if (formEvents.length === 0) { setFormError("Select at least one event."); return; }

    setSaving(true);
    setFormError("");
    try {
      const isEdit = Boolean(editingIntegration);
      const url = isEdit
        ? `/api/projects/${projectId}/integrations/${editingIntegration!.id}`
        : `/api/projects/${projectId}/integrations`;
      const body = isEdit
        ? { name: formName.trim() || null, webhookUrl: formUrl.trim(), events: formEvents }
        : { type: selectedType, name: formName.trim() || undefined, webhookUrl: formUrl.trim(), events: formEvents };

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setFormError(typeof data.error === "string" ? data.error : "Failed to save integration.");
        return;
      }
      const integration = (await res.json()) as Integration;
      if (isEdit) {
        setIntegrations((prev) => prev.map((i) => i.id === integration.id ? integration : i));
      } else {
        setIntegrations((prev) => [...prev, integration]);
      }
      closeForm();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteIntegration(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/projects/${projectId}/integrations/${id}`, { method: "DELETE" });
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function toggleEnabled(integration: Integration) {
    const next = !integration.enabled;
    setIntegrations((prev) => prev.map((i) => i.id === integration.id ? { ...i, enabled: next } : i));
    startToggle(async () => {
      await fetch(`/api/projects/${projectId}/integrations/${integration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
    });
  }

  // ── Upsell ──────────────────────────────────────────────────────────────────

  if (!isPro) {
    return (
      <div className="max-w-xl">
        <div className="rounded-2xl border border-line bg-card shadow-soft p-8 text-center">
          <div className="text-3xl mb-3">🔌</div>
          <h3 className="text-sm font-semibold text-ink mb-1">Integrations require a Pro plan</h3>
          <p className="text-xs text-muted mb-5 max-w-xs mx-auto">
            Connect Slack, Discord, or custom webhooks to receive real-time notifications when feedback arrives, votes are cast, and more.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-clay text-white text-sm font-medium hover:bg-clay/80 transition"
          >
            Upgrade to Pro →
          </Link>
        </div>
      </div>
    );
  }

  // ── Non-owner ────────────────────────────────────────────────────────────────

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface/50 p-5 text-center max-w-xl">
        <p className="text-sm text-muted">Integrations are managed by the project owner.</p>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────────

  const typeInfo = editingIntegration
    ? INTEGRATION_TYPES.find((t) => t.type === editingIntegration.type)
    : selectedType
    ? INTEGRATION_TYPES.find((t) => t.type === selectedType)
    : null;

  return (
    <div className="space-y-5 max-w-xl">

      {/* Existing integrations */}
      {!loading && integrations.length > 0 && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Connected integrations</h3>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-ink hover:border-line-strong transition"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2">
            {integrations.map((integration) => {
              const info = INTEGRATION_TYPES.find((t) => t.type === integration.type);
              const isEditing = editingIntegration?.id === integration.id;
              return (
                <div key={integration.id} className="rounded-xl border border-line bg-surface overflow-hidden">
                  {/* Row */}
                  <div className="flex items-start gap-3 p-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: info?.color ?? "#374151" }}
                    >
                      {info?.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {integration.name ?? info?.label ?? integration.type}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {integration.events.map((ev) => (
                          <span key={ev} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-clay/8 text-clay border border-clay/15">
                            {EVENT_LABELS[ev]?.label ?? ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleEnabled(integration)}
                        aria-pressed={integration.enabled}
                        className={`relative inline-flex h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          integration.enabled ? "bg-clay" : "bg-line-strong"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            integration.enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => isEditing ? closeForm() : openEditForm(integration)}
                        className={`text-xs transition ${isEditing ? "text-clay" : "text-faint hover:text-ink"}`}
                        aria-label="Edit integration"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        onClick={() => void deleteIntegration(integration.id)}
                        disabled={deleting === integration.id}
                        className="text-xs text-faint hover:text-red-500 transition disabled:opacity-40"
                        aria-label="Delete integration"
                      >
                        {deleting === integration.id ? "..." : "✕"}
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && typeInfo && (
                    <div className="border-t border-line px-4 pb-4 pt-3 bg-canvas">
                      <form onSubmit={(e) => void saveIntegration(e)} className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1">
                            Name <span className="font-normal text-faint">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={`e.g. ${typeInfo.label} #product`}
                            maxLength={100}
                            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1">
                            Webhook URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            value={formUrl}
                            onChange={(e) => { setFormUrl(e.target.value); setFormError(""); }}
                            placeholder={typeInfo.placeholder}
                            required
                            className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1.5">
                            Notify me when...
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {ALL_EVENTS.map((event) => (
                              <label key={event} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formEvents.includes(event)}
                                  onChange={() => toggleEvent(event)}
                                  className="h-3.5 w-3.5 rounded border-line accent-clay"
                                />
                                <span className="text-xs text-ink">{EVENT_LABELS[event].label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        {formError && <p className="text-xs text-red-500">{formError}</p>}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="px-3 py-1.5 rounded-xl bg-ink text-white text-xs font-medium hover:bg-ink/80 transition disabled:opacity-40"
                          >
                            {saving ? "Saving..." : "Save changes"}
                          </button>
                          <button
                            type="button"
                            onClick={closeForm}
                            className="px-3 py-1.5 rounded-xl border border-line text-xs text-muted hover:text-ink transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — pick a type to connect */}
      {!loading && integrations.length === 0 && !showForm && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <h3 className="text-sm font-semibold text-ink mb-1">Connect an integration</h3>
          <p className="text-xs text-muted mb-5">
            Get notified in real time when feedback arrives, votes are cast, statuses change, and more.
          </p>
          <div className="space-y-2">
            {INTEGRATION_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => openForm(t.type)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-clay/30 hover:bg-clay/3 text-left transition group"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: t.color }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{t.label}</p>
                  <p className="text-xs text-muted truncate">{t.description}</p>
                </div>
                <span className="text-xs text-faint group-hover:text-clay transition">Connect →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add more (when list is non-empty and "Add" is clicked) */}
      {!loading && integrations.length > 0 && showForm && !selectedType && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">Add integration</h3>
            <button onClick={closeForm} className="text-xs text-faint hover:text-ink transition">✕</button>
          </div>
          <div className="space-y-2">
            {INTEGRATION_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => openForm(t.type)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-line hover:border-clay/30 hover:bg-clay/3 text-left transition group"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: t.color }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{t.label}</p>
                  <p className="text-xs text-muted truncate">{t.description}</p>
                </div>
                <span className="text-xs text-faint group-hover:text-clay transition">Connect →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Configuration form */}
      {showForm && selectedType && typeInfo && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ background: typeInfo.color }}
            >
              {typeInfo.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Connect {typeInfo.label}</h3>
              <p className="text-xs text-muted">{typeInfo.description}</p>
            </div>
            <button onClick={closeForm} className="text-xs text-faint hover:text-ink transition ml-auto">✕</button>
          </div>

          <form onSubmit={(e) => void saveIntegration(e)} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Name <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={`e.g. ${typeInfo.label} #product`}
                maxLength={100}
                className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition"
              />
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Webhook URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => { setFormUrl(e.target.value); setFormError(""); }}
                placeholder={typeInfo.placeholder}
                required
                className="w-full text-sm rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-faint focus:outline-none focus:border-clay/40 transition font-mono"
              />
              {typeInfo.type === "SLACK" && (
                <p className="text-xs text-muted mt-1.5">
                  In Slack: <span className="font-medium">Apps → Incoming Webhooks → Add New Webhook</span>
                </p>
              )}
              {typeInfo.type === "DISCORD" && (
                <p className="text-xs text-muted mt-1.5">
                  In Discord: <span className="font-medium">Channel Settings → Integrations → Webhooks → New Webhook</span>
                </p>
              )}
            </div>

            {/* Events */}
            <div>
              <label className="block text-xs font-medium text-ink mb-2">
                Notify me when… <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {ALL_EVENTS.map((event) => (
                  <label key={event} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-line text-clay focus:ring-clay/40 accent-clay"
                    />
                    <div>
                      <span className="text-sm text-ink font-medium">{EVENT_LABELS[event].label}</span>
                      <span className="text-xs text-muted ml-2">{EVENT_LABELS[event].description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-ink text-white text-sm font-medium hover:bg-ink/80 transition disabled:opacity-40"
              >
                {saving ? "Connecting…" : "Connect"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-line bg-card shadow-soft p-6">
          <div className="h-4 w-32 bg-line rounded animate-pulse mb-3" />
          <div className="h-3 w-48 bg-line rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}
