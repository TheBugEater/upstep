/**
 * Lightweight profanity detector for feedback content.
 *
 * This is intentionally simple - a word-list match with light normalization to
 * catch common leetspeak / separator evasions. It is a heuristic to *flag*
 * content for review, not a guarantee. Feedback is still gated by the project's
 * moderation queue.
 */

// Base list of offensive terms (kept deliberately small and matched on word
// boundaries to limit false positives like "scunthorpe").
const BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "slut",
  "whore",
  "nigger",
  "faggot",
  "retard",
  "cock",
  "pussy",
  "motherfucker",
];

// Map common leetspeak substitutions back to letters before matching.
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

function normalize(text: string): string {
  const lowered = text.toLowerCase();
  let out = "";
  for (const ch of lowered) {
    out += LEET[ch] ?? ch;
  }
  // Collapse repeated chars (e.g. "shiiit" -> "shit") and strip separators
  // between letters so "f.u.c.k" / "f u c k" still match.
  return out.replace(/(.)\1{2,}/g, "$1");
}

/** Returns true if the text appears to contain profanity. */
export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  // Version with all non-letters removed, to catch separator evasion.
  const compact = normalized.replace(/[^a-z]/g, "");

  for (const word of BLOCKLIST) {
    // Word-boundary match in the normalized text…
    const boundary = new RegExp(`\\b${word}\\b`, "i");
    if (boundary.test(normalized)) return true;
    // …or a substring match in the separator-stripped version.
    if (compact.includes(word)) return true;
  }
  return false;
}
