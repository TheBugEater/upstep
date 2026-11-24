"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { SupportIcon } from "@/components/support/SupportIcons";

const VIEWS = [
  { id: "support", label: "Chat Support", icon: "message", panel: SupportPreview },
  { id: "feedback", label: "Feedback", icon: "arrow", panel: FeedbackPreview },
  { id: "roadmap", label: "Roadmap", icon: "check", panel: RoadmapPreview },
] as const;

export function ProductPreview() {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = VIEWS.length - 1;
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = selected === last ? 0 : selected + 1;
        break;
      case "ArrowLeft":
        next = selected === 0 ? last : selected - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setSelected(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Product preview"
          className="inline-flex max-w-full gap-0.5 rounded-xl border border-line bg-card p-1 shadow-soft sm:gap-1"
        >
          {VIEWS.map(({ id: view, label, icon }, index) => (
            <button
              key={view}
              ref={(button) => { buttons.current[index] = button; }}
              id={`${id}-${view}-tab`}
              role="tab"
              type="button"
              aria-controls={`${id}-${view}`}
              aria-selected={index === selected}
              tabIndex={index === selected ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={handleKeyDown}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-semibold text-muted transition hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-clay aria-selected:bg-clay-tint aria-selected:text-clay-dark sm:px-3 sm:text-xs"
            >
              <SupportIcon name={icon} className="hidden h-3.5 w-3.5 min-[360px]:block" />
              {label}
            </button>
          ))}
        </div>
        <span className="hidden text-[10px] uppercase tracking-wider text-faint xl:inline">
          Product preview
        </span>
      </div>

      {VIEWS.map(({ id: view, panel: Panel }, index) => (
        <div
          key={view}
          id={`${id}-${view}`}
          role="tabpanel"
          aria-labelledby={`${id}-${view}-tab`}
          tabIndex={0}
          hidden={index !== selected}
          className="rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay"
        >
          {index === selected && (
            <div className="relative isolate h-[418px] overflow-hidden rounded-3xl border border-clay/20 bg-[#f7dfd0] bg-[radial-gradient(ellipse_at_94%_105%,#eaa384,transparent_66%)] dark:bg-[#281811] dark:bg-[radial-gradient(ellipse_at_94%_105%,#693622,transparent_66%)] min-[360px]:h-[385px] sm:h-[411px]">
              <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,#87482a_1px,transparent_1px)] bg-[size:18px_18px] opacity-20 dark:opacity-40" />
              <Panel />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WindowBar({ title }: { title: string }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line px-3.5">
      <span aria-hidden className="grid h-5 w-5 place-items-center rounded-md bg-[#29211e] text-[11px] font-bold text-[#ffb38f]">N</span>
      <span className="text-[11px] font-semibold text-ink">Northstar</span>
      <span aria-hidden className="text-xs text-faint">/</span>
      <span className="text-[11px] text-muted">{title}</span>
    </div>
  );
}

const WINDOW = "overflow-hidden rounded-xl border border-line bg-card shadow-[0_15px_38px_-12px_rgba(76,34,14,0.35)]";

function SupportPreview() {
  return (
    <>
      <div className={`absolute inset-x-3 top-4 h-[283px] sm:inset-x-7 sm:top-8 sm:h-[302px] ${WINDOW}`}>
        <WindowBar title="Support inbox" />
        <div className="grid h-full grid-cols-[minmax(88px,0.72fr)_minmax(0,1.75fr)] sm:grid-cols-[minmax(133px,0.85fr)_minmax(0,1.65fr)]">
          <div className="border-r border-line bg-surface px-1.5 py-3 sm:px-2.5">
            <div className="mb-2 px-1.5 text-[10px] font-semibold text-ink sm:px-2">
              Waiting <span className="ml-1 text-faint">2</span>
            </div>
            <div className="rounded-md border border-clay/15 bg-clay-tint px-1.5 py-1.5 sm:px-2 sm:py-2">
              <p className="text-[10px] font-semibold text-ink sm:text-xs">Maya Chen</p>
              <p className="mt-0.5 truncate text-[9px] text-muted sm:text-[10px]">CSV export stuck</p>
            </div>
            <div className="px-1.5 py-2 sm:px-2">
              <p className="text-[10px] font-semibold text-ink sm:text-xs">Sam Rivera</p>
              <p className="mt-0.5 truncate text-[9px] text-muted sm:text-[10px]">Invite a teammate</p>
            </div>
            <p className="mt-3 border-t border-line px-1.5 pt-2 text-[10px] font-semibold text-muted sm:px-2">With team</p>
          </div>

          <div className="min-w-0 px-2.5 pt-3 sm:px-4">
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">CSV export stuck</p>
                <p className="mt-0.5 text-[10px] text-muted">Maya Chen</p>
              </div>
              <span className="shrink-0 rounded-full bg-clay-tint px-1.5 py-1 text-[8px] font-semibold text-clay-dark sm:px-2 sm:text-[10px]">Needs team</span>
            </div>
            <div className="space-y-2 border-t border-line pt-3">
              <p className="mr-1 w-fit rounded-xl rounded-bl-sm bg-raised px-2.5 py-2 text-[10px] leading-snug text-ink-soft sm:text-xs">My CSV export is stuck at 99%.</p>
              <div className="w-fit max-w-full rounded-xl rounded-bl-sm border border-line bg-surface px-2.5 py-2 text-[10px] leading-snug text-ink-soft sm:max-w-[84%] sm:text-xs">
                <p className="mb-1 text-[9px] font-semibold text-clay-dark">AI assistant</p>
                <p>Try exporting a shorter date range. If it still stalls, I can bring in the team.</p>
              </div>
              <p className="flex items-center gap-1.5 pt-1 text-[9px] font-medium text-muted sm:text-[10px]">
                <SupportIcon name="person" className="h-3 w-3 text-clay" />
                Sent to the support team
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={`absolute bottom-4 right-3 w-[188px] sm:bottom-6 sm:right-6 sm:w-[238px] ${WINDOW}`}>
        <div className="flex items-center gap-2 bg-[#29211e] px-3 py-2.5 text-white sm:px-4 sm:py-3">
          <SupportIcon name="message" className="h-4 w-4 text-[#ffb38f]" />
          <p className="text-[11px] font-semibold sm:text-xs">Northstar Support</p>
        </div>
        <div className="space-y-2 p-3 sm:space-y-2.5 sm:p-3.5">
          <p className="w-fit rounded-lg rounded-bl-sm bg-raised px-2.5 py-2 text-[10px] text-ink-soft sm:text-[11px]">
            Hi Maya, Alex here. I’ll take a look.
          </p>
          <p className="flex items-center gap-1.5 text-[9px] font-medium text-success sm:text-[10px]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
            Alex from support joined
          </p>
        </div>
      </div>
    </>
  );
}

const REQUESTS = [
  { title: "Save a dashboard filter", votes: 42, type: "Feature request" },
  { title: "Export reports as PDF", votes: 24, type: "Feature request" },
  { title: "Fix the date picker on mobile", votes: 13, type: "Bug report" },
];

function FeedbackPreview() {
  return (
    <div className={`absolute inset-x-3 top-4 sm:inset-x-7 sm:top-8 ${WINDOW}`}>
      <WindowBar title="Feedback board" />
      <div className="p-3 sm:p-5">
        <p className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Product feedback</p>
        <p className="mt-1 text-[10px] text-muted sm:text-xs">Ideas and bug reports, sorted by votes</p>
        <ul className="mt-3 divide-y divide-line rounded-xl border border-line sm:mt-4">
          {REQUESTS.map(({ title, votes, type }) => (
            <li key={title} className="flex items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3">
              <span className="inline-flex w-9 shrink-0 flex-col items-center rounded-md border border-clay/15 bg-clay-tint py-1 text-[10px] font-semibold text-clay-dark">
                <SupportIcon name="arrow" className="h-3 w-3" />
                <span><span className="sr-only">Votes: </span>{votes}</span>
              </span>
              <div>
                <p className="text-xs font-semibold text-ink sm:text-sm">{title}</p>
                <p className="mt-0.5 text-[10px] text-muted">{type}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const ROADMAP = [
  { status: "Planned", color: "text-warning", items: ["Export reports as PDF", "Scheduled reports"] },
  { status: "In progress", color: "text-info", items: ["Save a dashboard filter", "Add workspace roles"] },
  { status: "Shipped", color: "text-success", items: ["Mobile date picker fix", "CSV exports"] },
];

function RoadmapPreview() {
  return (
    <div className={`absolute inset-x-3 top-4 sm:inset-x-7 sm:top-8 ${WINDOW}`}>
      <WindowBar title="Public roadmap" />
      <div className="p-3 sm:p-5">
        <p className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Northstar roadmap</p>
        <p className="mt-1 text-[10px] text-muted sm:text-xs">See what’s coming and what’s already live.</p>
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-3">
          {ROADMAP.map(({ status, color, items }) => (
            <div key={status} className="min-w-0 rounded-lg border border-line bg-surface p-1.5 sm:p-2.5">
              <p className={`mb-2.5 text-[9px] font-semibold sm:text-[11px] ${color}`}>{status}</p>
              <ul className="space-y-1.5 sm:space-y-2">
                {items.map((item) => (
                  <li key={item} className="min-h-[46px] rounded-md border border-line bg-card p-1.5 text-[10px] font-medium leading-snug text-ink-soft sm:min-h-[53px] sm:p-2 sm:text-xs">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
