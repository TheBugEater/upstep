"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BusinessAvatar } from "./BusinessAvatar";
import { SetupQuestion } from "./SetupQuestion";
import { SupportIcon } from "./SupportIcons";
import type { BusinessLearning } from "@/lib/support/learning-types";
export type SupportSetupConfig = {
  enabled: boolean;
  domain: string;
  businessName: string;
  mode: string;
  welcomeMessage: string;
  crawlState?: string;
  crawlError?: string | null;
  crawledAt?: string | null;
  crawlGeneration: number;
  crawlVisitedCount: number;
  supportEmail: string | null;
  businessSummary: string | null;
  agentInstructions: string | null;
  businessProfile: {
    branding?: { logoUrl?: string | null };
    facts?: { label: string; value: string }[];
    answers?: { question: string; answer: string }[];
  } | null;
  learningState: string;
  learningAnalysis: BusinessLearning | null;
  learningError: string | null;
};
const field =
  "mt-2 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none transition focus:border-clay";
const button =
  "rounded-xl border border-line px-4 py-2.5 text-xs font-semibold text-ink transition hover:bg-surface disabled:opacity-50";
export function SupportSetup({
  projectId,
  apiKey,
  baseUrl,
  config,
  pageCount,
  isOwner,
  onSaved,
}: {
  projectId: string;
  apiKey: string;
  baseUrl: string;
  config: SupportSetupConfig | null;
  pageCount: number;
  isOwner: boolean;
  onSaved: () => Promise<void>;
}) {
  const [domain, setDomain] = useState(config?.domain || "");
  const [editing, setEditing] = useState(config?.learningState !== "READY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checked, setChecked] = useState(false);
  const [draft, setDraft] = useState({
    businessName: "",
    logoUrl: "",
    supportEmail: "",
    summary: "",
    instructions: "",
    welcomeMessage: "Hi! How can we help you today?",
    mode: "AI_FIRST",
    enabled: true,
  });
  const [editingFact, setEditingFact] = useState<number | null>(null);
  const [facts, setFacts] = useState<{ label: string; value: string }[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const marker = useRef("");
  const attemptedLogo = useRef("");
  const analysis = config?.learningAnalysis;
  const learning = config?.learningState === "LEARNING";
  const ready = config?.learningState === "READY";
  useEffect(() => {
    const next = `${config?.domain}:${config?.crawlGeneration}:${config?.learningState}`;
    if (marker.current === next) return;
    marker.current = next;
    setDomain(config?.domain || "");
    setChecked(false);
    if (config?.learningState !== "READY") setEditing(true);
    const info = config?.learningAnalysis;
    setDraft({
      businessName: ready
        ? config?.businessName || ""
        : info?.businessName || config?.businessName || "",
      logoUrl:
        config?.businessProfile?.branding &&
        "logoUrl" in config.businessProfile.branding
          ? config.businessProfile.branding.logoUrl || ""
          : info?.logoUrl || "",
      supportEmail: config?.supportEmail || info?.supportEmail || "",
      summary: config?.businessSummary || info?.summary || "",
      instructions:
        config?.agentInstructions ||
        info?.suggestedInstructions ||
        "Help customers understand our services, offer practical troubleshooting, and create a ticket for unresolved issues. Do not make account changes or promises outside our confirmed policies.",
      welcomeMessage:
        config?.welcomeMessage || "Hi! How can we help you today?",
      mode:
        config?.mode === "HUMAN_FIRST"
          ? "AI_FIRST"
          : config?.mode || "AI_FIRST",
      enabled: ready ? !!config?.enabled : true,
    });
    setFacts(
      config?.businessProfile?.facts ||
        info?.facts.map((f) => ({ label: f.label, value: f.value })) ||
        [],
    );
    setAnswers(
      Object.fromEntries(
        (info?.questions || []).map((q) => [
          q.id,
          config?.businessProfile?.answers?.find(
            (a) => a.question === q.question,
          )?.answer || "",
        ]),
      ),
    );
  }, [config, ready]);
  async function submit(body: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/projects/${projectId}/support/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save setup.");
      await onSaved();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function imageData(image: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context || !width || !height)
      throw new Error("Could not prepare the logo.");
    const scale = Math.min(128 / width, 128 / height);
    context.drawImage(
      image,
      (128 - width * scale) / 2,
      (128 - height * scale) / 2,
      width * scale,
      height * scale,
    );
    return canvas.toDataURL("image/png");
  }
  async function prepareRemoteLogo(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              "The icon could not be loaded. Try uploading a PNG, JPEG or WebP image.",
            ),
          ),
        15000,
      );
      image.onload = () => {
        clearTimeout(timer);
        try {
          resolve(imageData(image, image.naturalWidth, image.naturalHeight));
        } catch {
          reject(
            new Error(
              "The icon could not be prepared. Try uploading an image.",
            ),
          );
        }
      };
      image.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            "The icon could not be loaded. Try uploading a PNG, JPEG or WebP image.",
          ),
        );
      };
      image.src = `/api/projects/${projectId}/support/logo?url=${encodeURIComponent(url)}`;
    });
  }
  async function saveReview() {
    if (!config || !checked) return;
    if (analysis?.questions.some((q) => !answers[q.id]?.trim())) {
      setError(
        "Answer each setup question by choosing an option or writing your own answer.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const logoUrl = draft.logoUrl.startsWith("https://")
        ? await prepareRemoteLogo(draft.logoUrl)
        : draft.logoUrl;
      const ok = await submit({
        action: "confirm",
        review: {
          ...draft,
          logoUrl,
          generation: config.crawlGeneration,
          facts,
          answers,
        },
      });
      if (ok) {
        setEditing(false);
        setNotice(
          draft.enabled
            ? "Your AI support team is live."
            : "Business details saved. Support is paused.",
        );
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const findLogo = useCallback(async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}/support/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logo" }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not find the website icon.");
      if (data.logoUrl) {
        setDraft((current) => ({ ...current, logoUrl: data.logoUrl }));
        setNotice(
          "Website icon found. Review it and save your business details.",
        );
      } else
        setNotice(
          "No suitable website icon was found. Upload a logo or use a public image URL.",
        );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }, [projectId]);
  useEffect(() => {
    const branding = config?.businessProfile?.branding;
    if (
      !editing ||
      config?.learningState !== "READY" ||
      draft.logoUrl ||
      analysis?.logoUrl ||
      (branding && "logoUrl" in branding)
    )
      return;
    const key = `${projectId}:${config.domain}:${config.crawlGeneration}`;
    if (attemptedLogo.current === key) return;
    attemptedLogo.current = key;
    void findLogo();
  }, [
    editing,
    config?.learningState,
    config?.domain,
    config?.crawlGeneration,
    config?.businessProfile?.branding,
    draft.logoUrl,
    analysis?.logoUrl,
    projectId,
    findLogo,
  ]);
  async function uploadLogo(file: File) {
    setError("");
    setNotice("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG or WebP image under 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const image = await createImageBitmap(file);
      const logoUrl = imageData(image, image.width, image.height);
      image.close();
      setDraft((current) => ({ ...current, logoUrl }));
      setNotice("Logo uploaded. Save your business details to use it.");
    } catch {
      setError("Could not read that image. Try a PNG, JPEG or WebP file.");
    } finally {
      setBusy(false);
    }
  }
  const step = !config ? 0 : learning ? 1 : editing ? 2 : 3;
  const steps = [
    "Your website",
    "Learn the business",
    "Review & confirm",
    "Go live",
  ];
  const snippet = `<script defer src="${baseUrl}/sdk/upstep.js" data-api-key="${apiKey}"></script>`;
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 grid grid-cols-4 overflow-hidden rounded-xl border border-line bg-card">
        {steps.map((label, i) => (
          <div
            key={label}
            className={`relative px-3 py-4 sm:px-5 ${i === step ? "bg-clay/5" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${i < step ? "bg-clay text-white" : i === step ? "border border-clay text-clay" : "border border-line text-faint"}`}
              >
                {i < step ? (
                  <SupportIcon name="check" className="h-3 w-3" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-[11px] font-medium sm:block ${i === step ? "text-ink" : "text-faint"}`}
              >
                {label}
              </span>
            </div>
            <p
              className={`mt-2 text-[9px] sm:hidden ${i === step ? "text-ink" : "text-faint"}`}
            >
              {label}
            </p>
            {i === step && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-clay" />
            )}
          </div>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-5 text-sm text-success">
          {notice}
        </p>
      )}
      {(!config ||
        config.learningState === "NEW" ||
        learning ||
        (!editing && ready)) && (
        <section className="rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-clay">
                YOUR AI SUPPORT TEAM
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink">
                {learning
                  ? "Getting to know your business."
                  : ready
                    ? `${config.businessName} is ${config.enabled ? "ready to help" : "ready when you are"}.`
                    : "Start with your website."}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
                {learning
                  ? "We're reading the public pages and preparing a short review. You can leave this page and come back; your progress is saved."
                  : ready
                    ? "AI uses your website and confirmed business details to help customers, with private tickets whenever follow-up is needed."
                    : "We'll learn what you do, find useful business information, and ask only a few questions to fill the gaps. You review everything before customers see it."}
              </p>
            </div>
            {ready && (
              <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                {config.enabled ? "Live" : "Paused"}
              </span>
            )}
          </div>
          {!learning && !ready && (
            <form
              className="mt-6 max-w-xl"
              onSubmit={(e) => {
                e.preventDefault();
                void submit({ action: "learn", domain });
              }}
            >
              <label className="text-xs font-medium text-muted">
                Business website
                <input
                  autoFocus
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="yourbusiness.com"
                  maxLength={253}
                  className={field}
                />
              </label>
              <button
                disabled={busy || !domain.trim()}
                className={`${button} mt-4 bg-primary text-primary-fg`}
              >
                {busy ? "Starting…" : "Learn my business →"}
              </button>
            </form>
          )}
          {learning && (
            <div className="mt-7 space-y-4 rounded-xl bg-surface p-5">
              <p className="text-sm font-semibold text-ink">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-clay" />
                {config.crawlState === "READY"
                  ? "Connecting the dots and finding useful questions…"
                  : `Reading ${config.domain}…`}
              </p>
              <p className="text-xs text-muted">
                {pageCount} pages learned · {config.crawlVisitedCount || 0}{" "}
                pages checked
              </p>
              <p className="text-xs leading-6 text-faint">
                Next: confirm the business summary, the contact email customers
                should use, and what your AI should help with.
              </p>
            </div>
          )}
          {ready && !editing && (
            <>
              <div className="mt-5 flex items-center gap-3">
                <BusinessAvatar
                  name={config.businessName}
                  logoUrl={config.businessProfile?.branding?.logoUrl ?? null}
                />
                <p className="text-sm font-medium text-ink">
                  {config.businessName}
                </p>
              </div>
              <div className="mt-6 grid gap-4 rounded-xl bg-surface p-5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                    Business knowledge
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink">
                    {config.businessSummary}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                    Support contact
                  </p>
                  <p className="mt-2 text-sm text-ink">{config.supportEmail}</p>
                  <p className="mt-2 text-xs text-muted">
                    {pageCount} website pages · Confirmed business details
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className={button} onClick={() => setEditing(true)}>
                  Edit business details
                </button>
                <a
                  href={`${baseUrl}/support/${encodeURIComponent(apiKey)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={button}
                >
                  Try your assistant ↗
                </a>
              </div>
              <details className="mt-5">
                <summary className="cursor-pointer text-xs text-muted">
                  Learn from another website
                </summary>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit({ action: "learn", domain });
                  }}
                >
                  <input
                    aria-label="Business website"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className={field}
                  />
                  <button disabled={busy} className={button}>
                    Learn again
                  </button>
                </form>
              </details>
            </>
          )}
        </section>
      )}
      {config && config.learningState !== "NEW" && editing && !learning && (
        <form
          className="rounded-2xl border border-line bg-card p-6 shadow-soft sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            void saveReview();
          }}
        >
          <span className="text-xs font-semibold text-clay">
            REVIEW YOUR BUSINESS
          </span>
          <h2 className="mt-3 text-2xl font-semibold text-ink">
            Here's what we learned.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Check the details below, correct anything that needs it, and tell us
            how you want AI to help.
          </p>
          {config.learningError && (
            <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-6 text-ink">
              {config.learningError}
              <button
                type="button"
                disabled={busy}
                className={`${button} ml-3 mt-2`}
                onClick={() => void submit({ action: "learn", domain })}
              >
                Try learning again
              </button>
            </p>
          )}
          <section className="mt-6 rounded-xl border border-line bg-surface/50 p-4">
            <div className="flex items-center gap-4">
              <BusinessAvatar
                name={draft.businessName || "Business"}
                logoUrl={draft.logoUrl}
                size={56}
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  Business icon
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  We look for your website’s logo automatically. Review it or
                  choose your own.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={button}
                onClick={() => void findLogo()}
              >
                Find website icon
              </button>
              <label
                className={`${button} cursor-pointer ${busy ? "opacity-50" : ""}`}
              >
                Upload image
                <input
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {draft.logoUrl && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setDraft({ ...draft, logoUrl: "" })}
                >
                  Remove icon
                </button>
              )}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted">
                Use an image URL
              </summary>
              <label className="mt-2 block text-xs text-muted">
                Public HTTPS image URL
                <input
                  type="url"
                  maxLength={2000}
                  className={field}
                  value={draft.logoUrl.startsWith("data:") ? "" : draft.logoUrl}
                  placeholder="https://yourbusiness.com/logo.png"
                  onChange={(event) =>
                    setDraft({ ...draft, logoUrl: event.target.value })
                  }
                />
              </label>
            </details>
          </section>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Business name
              <input
                required
                maxLength={80}
                className={field}
                value={draft.businessName}
                onChange={(e) =>
                  setDraft({ ...draft, businessName: e.target.value })
                }
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Contact email for customer support
              <input
                required
                type="email"
                maxLength={254}
                placeholder="support@yourbusiness.com"
                className={field}
                value={draft.supportEmail}
                onChange={(e) =>
                  setDraft({ ...draft, supportEmail: e.target.value })
                }
              />
            </label>
            <p className="text-xs leading-5 text-faint sm:col-span-2">
              Customers will see this contact email beside their ticket
              reference. Confirm that it reaches the right team.
            </p>
            <label className="text-xs font-medium text-muted sm:col-span-2">
              What your business does
              <textarea
                required
                minLength={10}
                maxLength={4000}
                rows={3}
                className={field}
                value={draft.summary}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
              />
            </label>
          </div>
          {facts.length > 0 && (
            <div className="mt-8 border-t border-line pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    What your website tells us
                  </h3>
                  <p className="mt-1 text-xs text-faint">
                    {facts.length} useful{" "}
                    {facts.length === 1 ? "fact" : "facts"}. Check the sources
                    and edit anything that needs it.
                  </p>
                </div>
                <span className="rounded-full border border-line px-2.5 py-1 text-[9px] font-medium uppercase tracking-wide text-muted">
                  From your website
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {facts.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-line bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-xs font-semibold text-ink">
                        {f.label}
                      </h4>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingFact(editingFact === i ? null : i)
                        }
                        className="text-[10px] font-medium text-clay"
                      >
                        {editingFact === i ? "Done" : "Edit"}
                      </button>
                    </div>
                    {editingFact === i ? (
                      <textarea
                        aria-label={f.label}
                        required
                        rows={3}
                        maxLength={500}
                        className={field}
                        value={f.value}
                        onChange={(e) =>
                          setFacts(
                            facts.map((item, n) =>
                              n === i
                                ? { ...item, value: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      <p className="mt-2 text-xs leading-6 text-muted">
                        {f.value}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analysis?.facts[i]?.sources.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface px-1.5 py-1 text-[9px] text-faint transition hover:text-clay"
                        >
                          <SupportIcon
                            name="link"
                            className="h-2.5 w-2.5 shrink-0"
                          />
                          <span className="max-w-[180px] truncate">
                            {new URL(url).hostname}
                            {new URL(url).pathname}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!!analysis?.questions.length && (
            <section className="mt-8 rounded-2xl border border-line bg-surface/50 p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-ink">
                A few things only you can tell us
              </h3>
              <p className="mt-2 text-xs leading-6 text-muted">
                These questions come from gaps or unclear details in the
                website. It's fine to say “Ask the team” when AI should
                escalate.
              </p>
              <div className="mt-4 space-y-4">
                {analysis.questions.map((q) => (
                  <SetupQuestion
                    key={q.id}
                    question={q}
                    value={answers[q.id] || ""}
                    onChange={(answer) =>
                      setAnswers((current) => ({ ...current, [q.id]: answer }))
                    }
                  />
                ))}
              </div>
            </section>
          )}
          <div className="mt-7 space-y-5">
            <label className="block text-xs font-medium text-muted">
              What should AI help with, and when should it create a ticket?
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                className={field}
                value={draft.instructions}
                onChange={(e) =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted">
                Support mode
                <select
                  className={field}
                  value={draft.mode}
                  onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
                >
                  <option value="AI_FIRST">AI first, team when needed</option>
                  <option value="HUMAN_ONLY">Team only</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted">
                Welcome message
                <input
                  required
                  maxLength={500}
                  className={field}
                  value={draft.welcomeMessage}
                  onChange={(e) =>
                    setDraft({ ...draft, welcomeMessage: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              Enable customer support
            </label>
            <label className="flex items-start gap-2 rounded-xl bg-surface p-4 text-xs leading-6 text-ink">
              <input
                required
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1.5"
              />
              I've checked these business details and the contact email. AI can
              use them to help customers.
            </label>
          </div>
          <button
            disabled={busy || !checked}
            className={`${button} mt-6 bg-primary text-primary-fg`}
          >
            {busy
              ? "Saving…"
              : draft.enabled
                ? "Confirm and go live →"
                : "Save business details"}
          </button>
        </form>
      )}
      {ready && !editing && (
        <section className="mt-5 rounded-2xl border border-line bg-card p-6">
          <h3 className="text-sm font-semibold text-ink">
            Add it to your website.
          </h3>
          <p className="mt-2 text-xs leading-6 text-muted">
            Paste this before the closing body tag. An existing hosted UpStep
            widget picks up your new settings automatically.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl bg-surface p-4 text-xs leading-6 text-ink">
            {snippet}
          </pre>
          <button
            className={`${button} mt-3`}
            onClick={() =>
              void navigator.clipboard
                .writeText(snippet)
                .then(() => setNotice("Embed copied."))
                .catch(() =>
                  setError("Copy the embed from the code box above."),
                )
            }
          >
            Copy embed
          </button>
          {isOwner && (
            <details className="mt-5">
              <summary className="cursor-pointer text-xs text-muted">
                Signed-in customer identity
              </summary>
              <p className="mt-3 text-xs leading-6 text-muted">
                Pass a backend-signed identity token to restore customer history
                across devices. The signing secret belongs only on your backend.
              </p>
              <button
                className={`${button} mt-3`}
                onClick={() => {
                  void (async () => {
                    try {
                      const r = await fetch(
                        `/api/projects/${projectId}/support`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "identity" }),
                        },
                      );
                      const d = await r.json();
                      if (!r.ok) throw new Error();
                      await navigator.clipboard.writeText(d.secret);
                      setNotice(
                        "Identity signing secret copied. Keep it on your backend.",
                      );
                    } catch {
                      setError("Could not copy the identity secret.");
                    }
                  })();
                }}
              >
                Copy identity signing secret
              </button>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
