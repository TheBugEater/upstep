"use client";
import { useRef, useState } from "react";
import type { SupportWidget } from "@upstep/types";
const field =
  "mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-base text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";
const button =
  "rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200";
export function SupportWidgets({
  widgets,
  busy,
  name,
  email,
  verified,
  onReply,
  onDetails,
  onContact,
}: {
  widgets: SupportWidget[];
  busy: boolean;
  name: string;
  email: string;
  verified: boolean;
  onReply: (text: string) => Promise<boolean>;
  onDetails: (data: {
    widgetId: string;
    summary: string;
    details: string;
    reference: string;
    clientMessageId: string;
  }) => Promise<boolean>;
  onContact: (name: string, email: string) => Promise<boolean>;
}) {
  return (
    <div className="mt-4 space-y-3">
      {widgets.map((widget) => (
        <SupportWidgetCard
          key={widget.id}
          widget={widget}
          busy={busy}
          name={name}
          email={email}
          verified={verified}
          onReply={onReply}
          onDetails={onDetails}
          onContact={onContact}
        />
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
  onReply,
  onDetails,
  onContact,
}: {
  widget: SupportWidget;
  busy: boolean;
  name: string;
  email: string;
  verified: boolean;
  onReply: (text: string) => Promise<boolean>;
  onDetails: (data: {
    widgetId: string;
    summary: string;
    details: string;
    reference: string;
    clientMessageId: string;
  }) => Promise<boolean>;
  onContact: (name: string, email: string) => Promise<boolean>;
}) {
  const [fullName, setFullName] = useState(name);
  const [address, setAddress] = useState(email);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const id = useRef(crypto.randomUUID());
  if (done)
    return (
      <p
        role="status"
        className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300"
      >
        ✓{" "}
        {widget.type === "contact_form"
          ? "Your request is with the team."
          : "Details sent."}
      </p>
    );
  if (widget.type === "quick_replies" || widget.type === "confirmation")
    return (
      <div>
        <p className="mb-2 text-sm text-neutral-500">{widget.title}</p>
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
  if (widget.type === "contact_form")
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          {widget.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {widget.summary}
        </p>
        {!open ? (
          <button
            disabled={busy}
            className={`${button} mt-3`}
            onClick={() => setOpen(true)}
          >
            Ask the team
          </button>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void onContact(fullName, address).then((ok) => {
                if (ok) setDone(true);
              });
            }}
          >
            <p className="text-sm leading-6 text-neutral-500">
              Share your details so support can reach you about this issue.
            </p>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">
              Your name
              <input
                required
                autoComplete="name"
                maxLength={100}
                className={field}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400">
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                maxLength={254}
                readOnly={verified && !!email}
                className={field}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !fullName.trim() || !address.trim()}
              className={`${button} w-full !border-transparent !bg-[#5b7168] !text-white`}
            >
              {busy ? "Sending…" : "Send to the team"}
            </button>
          </form>
        )}
      </div>
    );
  return (
    <form
      className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60"
      onSubmit={(e) => {
        e.preventDefault();
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
      <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
        {widget.title}
      </h3>
      <label className="mt-3 block text-sm text-neutral-600 dark:text-neutral-400">
        What is happening?
        <input
          required
          maxLength={160}
          className={field}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm text-neutral-600 dark:text-neutral-400">
        What have you tried? (optional)
        <textarea
          maxLength={2000}
          rows={2}
          className={field}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm text-neutral-600 dark:text-neutral-400">
        Order or issue reference (optional)
        <input
          maxLength={100}
          className={field}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </label>
      <button
        disabled={busy || !summary.trim()}
        className={`${button} mt-4 w-full`}
      >
        Send details
      </button>
    </form>
  );
}
