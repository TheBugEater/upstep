import type { SupportReply } from "./ai";
type Turn = { role: string; metadata?: unknown };
/** Automatic escalation needs a help attempt; a direct human request is always allowed. */
export function hasTriedToHelp(history: Turn[], reason: string) {
  // Customers can request a person without exhausting automatic troubleshooting.
  if (reason === "human_requested") return true;
  const previous = history
    .filter((m) => m.role === "ASSISTANT")
    .map((m) => m.metadata as { inScope?: boolean; resolution?: string } | null)
    .filter((m) => m?.inScope === true);
  if (reason === "human_authority")
    return previous.some(
      (m) => m?.resolution === "clarify" || m?.resolution === "answer",
    );
  return previous.some((m) => m?.resolution === "answer");
}
export function assessEscalation(
  reply: SupportReply,
  history: Turn[],
): SupportReply {
  const escalation =
    reply.resolution === "escalate" ||
    (!reply.resolution && (reply.offerTicket || reply.handoff));
  if (
    !reply.inScope ||
    !escalation ||
    hasTriedToHelp(history, reply.escalationReason || "unresolved")
  )
    return reply;
  return {
    ...reply,
    resolution: "clarify",
    escalationReason: "none",
    reply:
      "I can try to help first. What’s happening, and what have you already tried?",
    offerTicket: false,
    handoff: false,
    issueSummary: "",
    sources: [],
    ticketTitle: "",
    quickReplies: [],
    requestDetails: true,
    askConfirmation: false,
  };
}
