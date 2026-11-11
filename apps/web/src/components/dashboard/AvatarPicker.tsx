"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { AvatarOption, AvatarSource } from "@/lib/avatar";

export interface ShellAvatar {
  /** Effective avatar URL, or null for initials. */
  image: string | null;
  source: AvatarSource;
  options: AvatarOption[];
}

interface Props {
  name: string | null | undefined;
  email: string;
  avatar: ShellAvatar;
  onChange: (image: string | null) => void;
}

/** Choose which linked account's picture to show, or initials. */
export function AvatarPicker({ name, email, avatar, onChange }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(avatar.source);
  const [saving, setSaving] = useState<AvatarSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSelected(avatar.source), [avatar.source]);

  async function choose(option: AvatarOption) {
    if (option.source === selected || saving) return;
    const previous = selected;
    setSelected(option.source);
    setSaving(option.source);
    setError(null);
    onChange(option.image);
    try {
      const res = await fetch("/api/account/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: option.source }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't save your picture.");
      onChange(data.image ?? null);
      // Server-rendered lists (board, team, comments) read the saved avatar.
      router.refresh();
    } catch (err) {
      setSelected(previous);
      onChange(avatar.options.find((o) => o.source === previous)?.image ?? null);
      setError(err instanceof Error ? err.message : "Couldn't save your picture.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="border-b border-line px-2.5 py-2">
      <p id="avatar-picker-label" className="mb-1.5 text-[11px] font-medium text-muted">Profile picture</p>
      <div role="radiogroup" aria-labelledby="avatar-picker-label" className="flex flex-wrap gap-1">
        {avatar.options.map((option) => {
          const active = option.source === selected;
          return (
            <button
              key={option.source}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!!saving}
              onClick={() => void choose(option)}
              className={`flex w-[58px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] transition disabled:cursor-wait ${active ? "bg-raised font-semibold text-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
            >
              <span className={`grid rounded-full p-[2px] ${active ? "ring-2 ring-clay" : ""}`}>
                <Avatar name={name} email={email} src={option.source === "INITIALS" ? null : option.image} size={28} tone="primary" decorative />
              </span>
              <span className="truncate">{saving === option.source ? "Saving…" : option.label}</span>
            </button>
          );
        })}
      </div>
      {avatar.options.some((o) => o.source !== "INITIALS" && !o.image) && (
        <p className="mt-1 text-[10px] leading-4 text-faint">Pictures update the next time you sign in with that account.</p>
      )}
      {error && <p role="alert" className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
