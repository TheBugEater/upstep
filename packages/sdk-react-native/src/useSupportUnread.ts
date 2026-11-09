import { useEffect, useRef, useState } from "react";
import { unreadSupportMessages, type SupportClient } from "@upstep/js/support";
import type { SupportConversation } from "@upstep/types";
type Message = SupportConversation["messages"][number];
/**
 * Tracks which AI or team messages the customer has read. The record is shared
 * with the launcher badge, so opening the chat from a badge shows where the new messages start.
 */
export function useSupportUnread({
  client,
  chat,
  viewing,
  onIncoming,
}: {
  client: SupportClient;
  chat: SupportConversation | null;
  /** The chat is on screen, scrolled to the latest message, and the app is active. */
  viewing: boolean;
  onIncoming: (latest: Message, wasViewing: boolean) => void;
}) {
  const seen = useRef<{ chat: string; id: string } | null>(null);
  const processed = useRef<string | null>(null);
  const incoming = useRef(onIncoming);
  incoming.current = onIncoming;
  const [count, setCount] = useState(0);
  const [firstUnread, setFirstUnread] = useState<string | null>(null);
  useEffect(() => {
    if (!chat) {
      seen.current = null;
      processed.current = null;
      setCount(0);
      setFirstUnread(null);
      return;
    }
    const last = chat.messages.filter((m) => m.role !== "SYSTEM").at(-1);
    if (!last) return;
    let cancelled = false;
    void (async () => {
      if (seen.current?.chat !== chat.id) {
        const saved = await client.seenId(chat.id);
        if (cancelled) return;
        seen.current = { chat: chat.id, id: saved ?? last.id };
        processed.current = last.id;
        const waiting = unreadSupportMessages(chat.messages, seen.current.id);
        setFirstUnread(waiting[0]?.id ?? null);
      }
      const current = seen.current;
      if (!current) return;
      const arrived = unreadSupportMessages(chat.messages, processed.current);
      processed.current = last.id;
      if (arrived.length)
        incoming.current(arrived[arrived.length - 1]!, viewing);
      if (viewing) {
        if (current.id !== last.id) {
          seen.current = { chat: chat.id, id: last.id };
          void client.markSeen(chat);
        }
        setCount(0);
        return;
      }
      const unread = unreadSupportMessages(chat.messages, current.id);
      setCount(unread.length);
      if (unread.length) setFirstUnread((c) => c ?? unread[0]!.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [chat, viewing, client]);
  return { count, firstUnread, clearDivider: () => setFirstUnread(null) };
}
