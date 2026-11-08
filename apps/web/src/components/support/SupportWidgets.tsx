"use client";
import { useRef, useState } from "react";
import type { SupportWidget } from "@upstep/types";
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
  "mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-black dark:text-neutral-100";
const button =
  "min-h-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-black dark:text-neutral-200";
const primary = `${button} !border-transparent !bg-[var(--support-accent)] !text-white`;
const label = "block text-[13px] text-neutral-600 dark:text-neutral-400";
function tabName(widget: SupportWidget) {
  return widget.type === "quick_replies"
    ? "Quick replies"
    : widget.type === "issue_details"
      ? "Issue details"
      : widget.type === "confirmation"
        ? "Did this help?"
        : "Team follow-up";
}
export function SupportWidgets(props: Props) {
  const [selected, setSelected] = useState(
    props.widgets.find((w) => w.type === "quick_replies")?.id ??
      props.widgets[0]?.id,
  );
  const widget =
    props.widgets.find((w) => w.id === selected) || props.widgets[0];
  if (!widget) return null;
  return (
    <div className="space-y-2">
      {props.widgets.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="Reply options">
          {props.widgets.map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={widget.id === w.id}
              className={`${button} !min-h-8 !py-1 ${widget.id === w.id ? "!bg-neutral-100 dark:!bg-neutral-900" : ""}`}
              onClick={() => setSelected(w.id)}
            >
              {tabName(w)}
            </button>
          ))}
        </div>
      )}
      <SupportWidgetCard key={widget.id} {...props} widget={widget} />
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
  onReply,
  onDetails,
  onContact,
}: Omit<Props, "widgets"> & { widget: SupportWidget }) {
  const [fullName, setFullName] = useState(name),
    [address, setAddress] = useState(email);
  const [summary, setSummary] = useState(""),
    [details, setDetails] = useState(""),
    [reference, setReference] = useState("");
  const [done, setDone] = useState(false),
    [step, setStep] = useState(0),
    [issueOpen, setIssueOpen] = useState(false),
    [more, setMore] = useState(false);
  const id = useRef(crypto.randomUUID());
  if (done)
    return (
      <p role="status" className="py-2 text-[13px] text-neutral-500">
        ✓{" "}
        {widget.type === "contact_form"
          ? "Your request is with the team."
          : "Details sent."}
      </p>
    );
  if (widget.type === "quick_replies" || widget.type === "confirmation")
    return (
      <div>
        <p className="mb-2 text-[13px] text-neutral-500">{widget.title}</p>
        <div className="flex flex-wrap gap-2">
          {widget.options.map((option) => (
            <button
              key={option}
              disabled={busy}
              className={button}
              onClick={() =>
                void onReply(option).then((ok) => {
                  if (ok) setDone(true);
                })
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  const shell =
    "rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950";
  if (widget.type === "contact_form")
    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-100">
            {online ? "Connect with the team" : widget.title}
          </h3>
          {step > 0 && (
            <span className="text-xs text-neutral-500">{step} of 2</span>
          )}
        </div>
        {step === 0 ? (
          <>
            <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-500">
              {widget.summary}
            </p>
            <button
              disabled={busy}
              className={`${button} mt-2`}
              onClick={() => setStep(1)}
            >
              Ask the team
            </button>
          </>
        ) : (
          <form
            className="mt-2 space-y-2"
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
    );
  return (
    <div className={shell}>
      <h3 className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-100">
        {widget.title}
      </h3>
      {!issueOpen ? (
        <button
          className={`${button} mt-2`}
          disabled={busy}
          onClick={() => setIssueOpen(true)}
        >
          Add issue details
        </button>
      ) : (
        <form
          className="mt-2 space-y-2"
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
            className="text-[13px] text-neutral-500 underline underline-offset-2"
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
            className={`${button} w-full`}
          >
            Send details
          </button>
        </form>
      )}
    </div>
  );
}
