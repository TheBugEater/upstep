"use client";
import { useState } from "react";
import type { IdeaPrompt } from "@upstep/types";
import { SupportIcon } from "./SupportIcons";

/** The open idea prompt: on the latest AI reply and not yet answered. */
export function activeIdeaPrompt(chat: {
  activeWidgetMessageId: string | null;
  messages: {
    id: string;
    metadata?: { ideaPrompt?: IdeaPrompt; ideaPromptId?: string };
  }[];
}): IdeaPrompt | null {
  const prompt = chat.activeWidgetMessageId
    ? chat.messages.find((m) => m.id === chat.activeWidgetMessageId)?.metadata
        ?.ideaPrompt
    : undefined;
  if (!prompt) return null;
  return chat.messages.some((m) => m.metadata?.ideaPromptId === prompt.id)
    ? null
    : prompt;
}

const shell =
  "overflow-hidden rounded-[var(--sx-r16,1rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] dark:border-[var(--sx-border,#262626)] dark:bg-[var(--sx-bg,#000)]";
const head =
  "flex items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--support-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--support-accent)_12%,transparent)] px-3 py-2 text-xs font-bold text-[color:color-mix(in_srgb,var(--support-accent)_62%,#171717)] dark:text-[color:color-mix(in_srgb,var(--support-accent)_55%,white)]";
const button =
  "min-h-10 rounded-[var(--sx-r8,0.5rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] px-3 py-2 text-[13px] font-medium text-[var(--sx-strong,#404040)] transition hover:bg-[var(--sx-subtle,#fafafa)] disabled:opacity-50 dark:border-[var(--sx-border,#404040)] dark:bg-[var(--sx-bg,#000)] dark:text-[var(--sx-strong,#e5e5e5)]";
const primary = `${button} !border-transparent !bg-[var(--support-accent)] !text-[var(--sx-accent-text,#fff)]`;
const field =
  "mt-1 block w-full rounded-[var(--sx-r8,0.5rem)] border border-[var(--sx-border,#e5e5e5)] bg-[var(--sx-bg,#fff)] px-3 py-2 text-base text-[var(--sx-soft-text,#262626)] outline-none focus:border-[var(--sx-hover-border,#a3a3a3)] dark:border-[var(--sx-border,#404040)] dark:bg-[var(--sx-bg,#000)] dark:text-[var(--sx-soft-text,#f5f5f5)]";
const label =
  "block text-[13px] text-[var(--sx-muted,#525252)] dark:text-[var(--sx-muted,#a3a3a3)]";
const muted =
  "text-[var(--sx-muted,#737373)] dark:text-[var(--sx-muted,#a3a3a3)]";

export function IdeaPromptCard({
  prompt,
  busy,
  onAnswer,
}: {
  prompt: IdeaPrompt;
  busy: boolean;
  onAnswer: (
    answer: { feedbackId: string } | { title: string; details?: string },
  ) => Promise<boolean>;
}) {
  const [suggesting, setSuggesting] = useState(!prompt.matches.length);
  const [title, setTitle] = useState(prompt.suggestedTitle);
  const [details, setDetails] = useState("");
  return (
    <div className={shell}>
      <div className={head}>
        <SupportIcon name="arrow" className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">{prompt.title}</span>
      </div>
      <div className="space-y-2 p-3">
        {prompt.matches.length > 0 && (
          <ul className="space-y-1.5" aria-label="Matching ideas">
            {prompt.matches.map((idea) => (
              <li
                key={idea.id}
                className="flex items-center gap-2.5 rounded-[var(--sx-r12,0.75rem)] border border-[var(--sx-border,#e5e5e5)] px-2.5 py-2 dark:border-[var(--sx-border,#404040)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-5 text-[var(--sx-text,#171717)] dark:text-[var(--sx-text,#f5f5f5)]">
                    {idea.title}
                  </span>
                  <span className={`text-xs ${muted}`}>
                    {idea.upvotes} {idea.upvotes === 1 ? "vote" : "votes"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={`${primary} shrink-0 !min-h-9 !px-3 !text-xs`}
                  onClick={() => void onAnswer({ feedbackId: idea.id })}
                >
                  Vote
                </button>
              </li>
            ))}
          </ul>
        )}
        {!suggesting ? (
          <button
            type="button"
            disabled={busy}
            className={`${button} inline-flex w-full items-center justify-center gap-1.5`}
            onClick={() => setSuggesting(true)}
          >
            <SupportIcon name="plus" className="h-3.5 w-3.5" />
            None of these, suggest a new idea
          </button>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onAnswer({
                title,
                ...(details.trim() ? { details } : {}),
              });
            }}
          >
            {!prompt.matches.length && (
              <p className={`text-[13px] leading-5 ${muted}`}>
                Share it publicly so others can vote for it too. Only what you
                write here is posted.
              </p>
            )}
            <label className={label}>
              Idea
              <input
                required
                minLength={3}
                maxLength={160}
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className={label}>
              Why it would help (optional)
              <textarea
                rows={2}
                maxLength={2000}
                className={field}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              {prompt.matches.length > 0 && (
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => setSuggesting(false)}
                >
                  Back
                </button>
              )}
              <button
                disabled={busy || title.trim().length < 3}
                className={`${primary} flex-1`}
              >
                {busy ? "Posting…" : "Post to ideas"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
