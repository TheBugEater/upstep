type Message = { id: string; role: string };
/** Incoming AI or team messages after a given message. Used for both "unread" and "just arrived". */
export function unreadAfter<T extends Message>(
  messages: T[],
  seenId: string | null,
): T[] {
  if (seenId === null) return [];
  const readable = messages.filter((m) => m.role !== "SYSTEM");
  const index = readable.findIndex((m) => m.id === seenId);
  if (index < 0) return [];
  return readable.slice(index + 1).filter((m) => m.role !== "CUSTOMER");
}
export function lastReadableId(messages: Message[]) {
  return messages.filter((m) => m.role !== "SYSTEM").at(-1)?.id ?? null;
}
export function preview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
