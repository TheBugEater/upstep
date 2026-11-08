import type { SupportReply } from "./ai";
export type ChatWidget =
  | { id: string; type: "quick_replies"; title: string; options: string[] }
  | { id: string; type: "issue_details"; title: string }
  | { id: string; type: "confirmation"; title: string; options: string[] }
  | { id: string; type: "contact_form"; title: string; summary: string };
export function formatSupportReply(text: string) {
  const clean = text
    .replace(/^\s*\[\d+(?:\s*,\s*\d+)*\]\s*$/gm, "")
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/([.!?]), /g, "$1 ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .trim();
  const paragraphs = clean.split(/\n+/).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs.join("\n\n");
  const sentences = Array.from(
    new Intl.Segmenter("en", { granularity: "sentence" }).segment(clean),
    (s) => s.segment.trim(),
  ).filter(Boolean);
  if (sentences.length > 2)
    return [sentences.slice(0, 2).join(" "), sentences.slice(2).join(" ")].join(
      "\n\n",
    );
  return clean;
}
export function replyWidgets(
  result: SupportReply,
  turnId: string,
): ChatWidget[] {
  if (!result.inScope) return [];
  const widgets: ChatWidget[] = [];
  const resolution =
    result.resolution ||
    (result.offerTicket || result.handoff ? "escalate" : "answer");
  const summary = (result.issueSummary || result.ticketTitle).trim();
  if (resolution === "escalate" && summary.length >= 10)
    widgets.push({
      id: `contact:${turnId}`,
      type: "contact_form",
      title: "Let the team follow up",
      summary,
    });
  else if (result.requestDetails)
    widgets.push({
      id: `details:${turnId}`,
      type: "issue_details",
      title: "Tell us a little more",
    });
  else if (result.askConfirmation)
    widgets.push({
      id: `confirm:${turnId}`,
      type: "confirmation",
      title: "Did this help?",
      options: ["Yes, that helped", "I still need help"],
    });
  if (result.quickReplies?.length && resolution !== "escalate")
    widgets.push({
      id: `quick:${turnId}`,
      type: "quick_replies",
      title: "Quick replies",
      options: result.quickReplies.slice(0, 3).map(formatSupportReply),
    });
  return widgets;
}
