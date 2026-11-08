"use client";
import { useState } from "react";
import type { BusinessLearning } from "@/lib/support/learning-types";
export function SetupQuestion({
  question,
  value,
  onChange,
}: {
  question: BusinessLearning["questions"][number];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = question.inputType === "choice" ? question.options || [] : [];
  const [custom, setCustom] = useState(!!value && !options.includes(value));
  const field =
    "mt-2 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-clay";
  return (
    <fieldset className="rounded-xl border border-line bg-card p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        {question.question}
      </legend>
      {options.length >= 2 && (
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-left text-sm transition focus-within:ring-1 focus-within:ring-clay ${!custom && value === option ? "border-clay bg-clay/5 text-ink" : "border-line text-muted hover:bg-surface"}`}
            >
              <input
                type="radio"
                name={`setup-question-${question.id}`}
                value={option}
                checked={!custom && value === option}
                required={!custom}
                onChange={() => {
                  setCustom(false);
                  onChange(option);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-clay"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
      {options.length >= 2 && (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-clay underline underline-offset-2"
          aria-expanded={custom}
          onClick={() => {
            setCustom(!custom);
            if (!custom) onChange("");
          }}
        >
          {custom ? "Use a suggested choice" : "Write my own answer"}
        </button>
      )}
      {(options.length < 2 || custom) && (
        <textarea
          aria-label={question.question}
          required
          rows={2}
          maxLength={1000}
          placeholder={question.suggestion || "Your answer…"}
          className={field}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {options.length >= 2 && !custom && !value && (
        <p className="mt-2 text-xs text-faint">
          Choose an option or write your own answer.
        </p>
      )}
    </fieldset>
  );
}
