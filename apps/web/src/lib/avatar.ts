// Profile picture resolution. Pure functions only, so they can run anywhere
// (auth events, API routes, tests) without touching the database.

export type AvatarSource = "GITHUB" | "GOOGLE" | "INITIALS";
export type ProviderAvatarSource = Exclude<AvatarSource, "INITIALS">;

export interface AvatarAccount {
  provider: string;
  image: string | null;
  createdAt?: Date | string | null;
}

export interface AvatarOption {
  source: AvatarSource;
  label: string;
  image: string | null;
}

const PROVIDER_SOURCES: Record<string, ProviderAvatarSource> = {
  github: "GITHUB",
  google: "GOOGLE",
};

const SOURCE_LABELS: Record<AvatarSource, string> = {
  GITHUB: "GitHub",
  GOOGLE: "Google",
  INITIALS: "Initials",
};

const MAX_URL_LENGTH = 2048;

export function isAvatarSource(value: unknown): value is AvatarSource {
  return value === "GITHUB" || value === "GOOGLE" || value === "INITIALS";
}

/** Map an Auth.js provider id (`github`, `google`) to its avatar source. */
export function sourceForProvider(provider: string): ProviderAvatarSource | null {
  return PROVIDER_SOURCES[provider] ?? null;
}

/** Only absolute https URLs are rendered; anything else falls back to initials. */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Read the picture from a raw OAuth profile: GitHub `avatar_url`, Google `picture`. */
export function avatarFromProfile(provider: string, profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const fields = profile as Record<string, unknown>;
  if (provider === "github") return safeAvatarUrl(fields.avatar_url);
  if (provider === "google") return safeAvatarUrl(fields.picture);
  return null;
}

function linkedAccounts(accounts: AvatarAccount[]) {
  return accounts
    .map((account, index) => ({ account, index, source: sourceForProvider(account.provider) }))
    .filter((entry): entry is typeof entry & { source: ProviderAvatarSource } => entry.source !== null)
    .sort((a, b) => {
      const at = a.account.createdAt ? new Date(a.account.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.account.createdAt ? new Date(b.account.createdAt).getTime() : Number.POSITIVE_INFINITY;
      return at - bt || a.index - b.index;
    });
}

/**
 * The URL to show for a user, or null for initials.
 *
 * - `INITIALS` always shows initials.
 * - `GITHUB` / `GOOGLE` show that provider's picture, or initials when it has none.
 * - No choice yet means the earliest linked provider (the one they signed up with).
 */
export function resolveAvatar(input: { source: AvatarSource | null | undefined; accounts: AvatarAccount[] }): string | null {
  const linked = linkedAccounts(input.accounts);
  if (input.source === "INITIALS") return null;
  if (input.source) {
    const match = linked.find((entry) => entry.source === input.source && safeAvatarUrl(entry.account.image));
    return match ? safeAvatarUrl(match.account.image) : null;
  }
  const first = linked[0];
  return first ? safeAvatarUrl(first.account.image) : null;
}

/** The source the picker should show as selected. */
export function effectiveAvatarSource(input: { source: AvatarSource | null | undefined; accounts: AvatarAccount[] }): AvatarSource {
  if (input.source) return input.source;
  return linkedAccounts(input.accounts)[0]?.source ?? "INITIALS";
}

/** Picker choices: each linked provider (once), then initials. */
export function avatarOptions(accounts: AvatarAccount[]): AvatarOption[] {
  const options: AvatarOption[] = [];
  for (const { account, source } of linkedAccounts(accounts)) {
    const image = safeAvatarUrl(account.image);
    const existing = options.find((option) => option.source === source);
    if (existing) {
      existing.image ??= image;
      continue;
    }
    options.push({ source, label: SOURCE_LABELS[source], image });
  }
  options.push({ source: "INITIALS", label: SOURCE_LABELS.INITIALS, image: null });
  return options;
}

/** Whether a user may pick this source: initials, or a provider they linked. */
export function canUseAvatarSource(source: AvatarSource, accounts: AvatarAccount[]): boolean {
  return source === "INITIALS" || accounts.some((account) => sourceForProvider(account.provider) === source);
}

/** Up to two letters from a display name, falling back to the email's local part. */
export function avatarInitials(name: string | null | undefined, email?: string | null): string {
  const base = name?.trim() || email?.split("@")[0]?.trim() || "";
  const words = base.split(/[\s._-]+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0]!, words[words.length - 1]!] : words.slice(0, 1);
  return picked.map((word) => Array.from(word)[0]).join("").toUpperCase() || "?";
}
