"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SupportIcon } from "./SupportIcons";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  /** Tailwind background class for a status dot, e.g. "bg-success". */
  dot?: string;
};

// A styled listbox to replace native <select> in support screens: keyboard
// navigable (arrows, Home/End, Enter, Escape, type-ahead), closes on outside
// click, and supports a secondary line per option.
export function SupportSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  prefix,
  placeholder = "Choose…",
  disabled,
  align = "left",
  className = "",
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  prefix?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const show = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (i: number) => {
    const option = options[i];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    root.current?.querySelector("button")?.focus();
  };
  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") root.current?.querySelector("button")?.focus();
      if (e.key === "Tab") return;
    } else if (e.key.length === 1) {
      const i = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(e.key.toLowerCase()),
      );
      if (i >= 0) setActive(i);
      else return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-left text-sm text-ink transition hover:border-line-strong focus:border-clay focus:outline-none disabled:opacity-50"
      >
        {prefix && <span className="text-faint">{prefix}</span>}
        {selected?.dot && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />
        )}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-faint"}`}>
          {selected?.label || placeholder}
        </span>
        <SupportIcon
          name="chevron"
          className={`h-3.5 w-3.5 shrink-0 text-faint transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className={`absolute z-30 mt-1.5 max-h-72 w-max min-w-full max-w-[22rem] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-lift outline-none ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink ${i === active ? "bg-raised" : ""}`}
            >
              {o.dot && (
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${o.dot}`} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block whitespace-nowrap">{o.label}</span>
                {o.description && (
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {o.description}
                  </span>
                )}
              </span>
              {o.value === value && (
                <SupportIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
