"use client";
import { useEffect, useRef, useState } from "react";
import { lastReadableId, unreadAfter } from "@/lib/support/unread";
type Message = { id: string; role: string };
type Options<T extends Message> = {
  storageKey: string;
  chatId: string | null;
  messages: T[];
  /** The chat is on screen, scrolled to the latest message, in a visible tab. */
  viewing: boolean;
  onIncoming: (latest: T, wasViewing: boolean) => void;
};
/**
 * Tracks which AI or team messages the customer has seen. A conversation with
 * no saved record counts as read, so returning visitors never get a stale badge.
 */
export function useSupportUnread<T extends Message>({
  storageKey,
  chatId,
  messages,
  viewing,
  onIncoming,
}: Options<T>) {
  const seen = useRef<{ chat: string; id: string } | null>(null);
  const processed = useRef<string | null>(null);
  const incoming = useRef(onIncoming);
  incoming.current = onIncoming;
  const [count, setCount] = useState(0);
  const [firstUnread, setFirstUnread] = useState<string | null>(null);
  useEffect(() => {
    if (!chatId) {
      seen.current = null;
      processed.current = null;
      setCount(0);
      setFirstUnread(null);
      return;
    }
    const last = lastReadableId(messages);
    if (!last) return;
    if (seen.current?.chat !== chatId) {
      let saved: { chat?: string; id?: string } | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      } catch {}
      seen.current = {
        chat: chatId,
        id: saved?.chat === chatId && saved.id ? saved.id : last,
      };
      processed.current = last;
      // Replies that came in while the customer was away get a "New" divider.
      const waiting = unreadAfter(messages, seen.current.id);
      setFirstUnread(waiting[0]?.id ?? null);
    }
    const arrived = unreadAfter(messages, processed.current);
    processed.current = last;
    if (arrived.length) incoming.current(arrived[arrived.length - 1]!, viewing);
    if (viewing) {
      if (seen.current.id !== last) {
        seen.current = { chat: chatId, id: last };
        try {
          localStorage.setItem(storageKey, JSON.stringify(seen.current));
        } catch {}
      }
      setCount(0);
      return;
    }
    const unread = unreadAfter(messages, seen.current.id);
    setCount(unread.length);
    if (unread.length) setFirstUnread((current) => current ?? unread[0]!.id);
  }, [chatId, messages, viewing, storageKey]);
  return {
    count,
    firstUnread,
    clearDivider: () => setFirstUnread(null),
  };
}
