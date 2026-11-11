"use client";
import { useRef, useState } from "react";
import type { SupportWidget } from "@upstep/types";
import { SupportIcon } from "./SupportIcons";
type Details = {
  widgetId: string;
  summary: string;
  details: string;
  reference: string;
  clientMessageId: string;
};
type Props = {
  widgets: SupportWidget[];
  busy: boolean;
  name: string;
  email: string;
  verified: boolean;
  online?: boolean;
  onReply: (text: string) => Promise<boolean>;
  onDetails: (data: Details) => Promise<boolean>;
  onContact: (name: string, email: string) => Promise<boolean>;
};
const field =
  "mt-1 block w-full rounded-[var(--sx-r8,0.5rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] px-3 py-2 text-base text-[var(--sx-soft-text,#262626)] outline-none focus:border-[var(--sx-hover-border,#a3a3a3)] dark:border-[var(--sx-border,#404040)] dark:bg-[var(--sx-bg,#000)] dark:text-[var(--sx-soft-text,#f5f5f5)]";
const button =
  "min-h-10 rounded-[var(--sx-r8,0.5rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] px-3 py-2 text-[13px] font-medium text-[var(--sx-strong,#404040)] transition hover:bg-[var(--sx-subtle,#fafafa)] disabled:opacity-50 dark:border-[var(--sx-border,#404040)] dark:bg-[var(--sx-bg,#000)] dark:text-[var(--sx-strong,#e5e5e5)]";
const primary = `${button} !border-transparent !bg-[var(--support-accent)] !text-[var(--sx-accent-text,#fff)]`;
const label =
  "block text-[13px] text-[var(--sx-muted,#525252)] dark:text-[var(--sx-muted,#a3a3a3)]";
/** Accent fills are reserved for things the customer can tap. Replies get a tinted pill. */
const chip =
  "inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-[color:color-mix(in_srgb,var(--support-accent)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--support-accent)_12%,transparent)] py-0 pl-3 pr-4 text-sm font-semibold text-[color:color-mix(in_srgb,var(--support-accent)_62%,#171717)] transition hover:border-[var(--support-accent)] hover:bg-[var(--support-accent)] hover:text-[var(--sx-accent-text,#fff)] disabled:opacity-50 dark:text-[color:color-mix(in_srgb,var(--support-accent)_55%,white)] sm:min-h-9";
const textAction =
  "inline-flex min-h-8 items-center gap-1.5 rounded-[var(--sx-r6,0.375rem)] px-1.5 text-xs font-semibold text-[var(--sx-muted,#737373)] transition hover:text-[var(--sx-text,#0a0a0a)] hover:underline disabled:opacity-50 dark:text-[var(--sx-muted,#a3a3a3)] dark:hover:text-[var(--sx-text,#fff)]";
const isChoice = (w: SupportWidget) =>
  w.type === "quick_replies" || w.type === "confirmation";
function actionLabel(widget: SupportWidget) {
  return widget.type === "contact_form" ? "Talk to a person" : "Add details";
}
export function SupportWidgets(props: Props) {
  const choice = props.widgets.find(isChoice);
  const others = props.widgets.filter((w) => !isChoice(w));
  const [opened, setOpened] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const expanded = others.find((w) => w.id === opened);
  // Without choices, the follow-up card is the only thing to show, so open it directly.
  const direct = choice ? [] : others;
  return (
    <div className="space-y-2.5">
      {choice && !answered && (
        <div className="rounded-[var(--sx-r16,1rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] p-2.5 dark:border-[var(--sx-border,#262626)] dark:bg-[var(--sx-bg,#000)] sm:p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--sx-muted,#737373)] dark:text-[var(--sx-muted,#a3a3a3)]">
              {choice.title || "Quick replies"}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {others.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={props.busy}
                  aria-expanded={opened === w.id}
                  className={textAction}
                  onClick={() => setOpened(opened === w.id ? null : w.id)}
                >
                  {w.type === "contact_form" && (
                    <SupportIcon name="person" className="h-3.5 w-3.5" />
                  )}
                  {actionLabel(w)}
                </button>
              ))}
            </div>
          </div>
          <div
            className="-mx-2.5 flex gap-2 overflow-x-auto px-2.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] max-sm:[mask-image:linear-gradient(90deg,#000_calc(100%-28px),transparent)] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label={choice.title || "Quick replies"}
          >
            {"options" in choice &&
              choice.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={props.busy}
                  className={chip}
                  onClick={() =>
                    void props.onReply(option).then((ok) => {
                      if (ok) setAnswered(true);
                    })
                  }
                >
                  <SupportIcon name="reply" className="h-3.5 w-3.5 shrink-0" />
                  {option}
                </button>
              ))}
          </div>
        </div>
      )}
      {expanded && !direct.length && (
        <SupportWidgetCard
          key={expanded.id}
          {...props}
          widget={expanded}
          startOpen
        />
      )}
      {direct.map((w) => (
        <SupportWidgetCard key={w.id} {...props} widget={w} />
      ))}
    </div>
  );
}
function SupportWidgetCard({
  widget,
  busy,
  name,
  email,
  verified,
  online,
  startOpen = false,
  onDetails,
  onContact,
}: Omit<Props, "widgets" | "onReply"> & {
  widget: SupportWidget;
  startOpen?: boolean;
}) {
  const [fullName, setFullName] = useState(name),
    [address, setAddress] = useState(email);
  const [summary, setSummary] = useState(""),
    [details, setDetails] = useState(""),
    [reference, setReference] = useState("");
  const [done, setDone] = useState(false),
    [step, setStep] = useState(startOpen ? 1 : 0),
    [issueOpen, setIssueOpen] = useState(startOpen),
    [more, setMore] = useState(false);
  const id = useRef(crypto.randomUUID());
  if (done)
    return (
      <p
        role="status"
        className="flex items-center gap-1.5 py-2 text-[13px] text-[var(--sx-muted,#737373)]"
      >
        <SupportIcon name="check" className="h-3.5 w-3.5" />
        {widget.type === "contact_form"
          ? "Your request is with the team."
          : "Details sent."}
      </p>
    );
  if (isChoice(widget)) return null;
  const shell =
    "overflow-hidden rounded-[var(--sx-r16,1rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] dark:border-[var(--sx-border,#262626)] dark:bg-[var(--sx-bg,#000)]";
  const head = (title: string, aside?: string) => (
    <div className="flex items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--support-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--support-accent)_12%,transparent)] px-3 py-2 text-xs font-bold text-[color:color-mix(in_srgb,var(--support-accent)_62%,#171717)] dark:text-[color:color-mix(in_srgb,var(--support-accent)_55%,white)]">
      <SupportIcon
        name={widget.type === "contact_form" ? "person" : "message"}
        className="h-3.5 w-3.5"
      />
      <span className="flex-1 truncate">{title}</span>
      {aside && <span className="font-medium opacity-80">{aside}</span>}
    </div>
  );
  if (widget.type === "contact_form")
    return (
      <div className={shell}>
        {head(
          online ? "Connect with the team" : widget.title,
          step > 0 ? `${step} of 2` : undefined,
        )}
        <div className="p-3">
          {step === 0 ? (
            <>
              <p className="line-clamp-2 text-[13px] leading-5 text-[var(--sx-muted,#737373)] dark:text-[var(--sx-muted,#a3a3a3)]">
                {widget.summary}
              </p>
              <button
                disabled={busy}
                className={`${primary} mt-2.5 w-full`}
                onClick={() => setStep(1)}
              >
                Talk to a person
              </button>
            </>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (step === 1) {
                  if (fullName.trim()) setStep(2);
                  return;
                }
                void onContact(fullName, address).then((ok) => {
                  if (ok) setDone(true);
                });
              }}
            >
              {step === 1 ? (
                <label className={label}>
                  Your name
                  <input
                    required
                    autoFocus
                    autoComplete="name"
                    maxLength={100}
                    className={field}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>
              ) : (
                <label className={label}>
                  Email for support follow-up
                  <input
                    required
                    autoFocus
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    readOnly={verified && !!email}
                    className={field}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
                <button
                  disabled={
                    busy || !fullName.trim() || (step === 2 && !address.trim())
                  }
                  className={`${primary} flex-1`}
                >
                  {step === 1
                    ? "Continue"
                    : busy
                      ? "Sending…"
                      : online
                        ? "Request transfer"
                        : "Send to the team"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  return (
    <div className={shell}>
      {head(widget.title)}
      <div className="p-3">
        {!issueOpen ? (
          <button
            className={`${primary} w-full`}
            disabled={busy}
            onClick={() => setIssueOpen(true)}
          >
            Add issue details
          </button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onDetails({
                widgetId: widget.id,
                summary,
                details,
                reference,
                clientMessageId: id.current,
              }).then((ok) => {
                if (ok) setDone(true);
              });
            }}
          >
            <label className={label}>
              What is happening?
              <input
                required
                autoFocus
                maxLength={160}
                className={field}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="text-[13px] text-[var(--sx-muted,#737373)] underline underline-offset-2"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              {more
                ? "Hide optional details"
                : "Add notes or a reference (optional)"}
            </button>
            {more && (
              <>
                <label className={label}>
                  What have you tried?
                  <textarea
                    maxLength={2000}
                    rows={2}
                    className={field}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </label>
                <label className={label}>
                  Order or issue reference
                  <input
                    maxLength={100}
                    className={field}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </>
            )}
            <button
              disabled={busy || !summary.trim()}
              className={`${primary} w-full`}
            >
              Send details
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
