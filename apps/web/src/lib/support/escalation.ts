import type { SupportReply } from "./ai";
type Turn = { role: string; metadata: unknown };
/** A request for an agent is not evidence that AI has tried to help. */
export function hasTriedToHelp(history: Turn[], reason: string) {
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
