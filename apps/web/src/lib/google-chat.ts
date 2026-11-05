import { createHash, randomUUID } from "node:crypto";
import type { IntegrationPayload } from "./integrations";

const INVALID_WEBHOOK = "Use a Google Chat webhook URL from https://chat.googleapis.com/v1/spaces/…/messages with its key and token.";

export function googleChatRequestId(deliveryId: string, integrationId: string): string {
  // Derive a UUID from the persisted event identity, keeping request IDs bounded
  // and identical across retries at the same destination.
  const bytes = createHash("sha256").update(JSON.stringify([deliveryId, integrationId])).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function googleChatWebhookUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(INVALID_WEBHOOK); }
  if (url.protocol !== "https:" || url.hostname !== "chat.googleapis.com" || url.port ||
      url.username || url.password || url.hash ||
      !/^\/v1\/spaces\/[A-Za-z0-9_-]+\/messages$/.test(url.pathname) ||
      !url.searchParams.get("key")?.trim() || !url.searchParams.get("token")?.trim()) {
    throw new Error(INVALID_WEBHOOK);
  }
  // Only retain the credentials. Threading and retry options belong to UpStep.
  const clean = new URL(url.origin + url.pathname);
  clean.searchParams.set("key", url.searchParams.get("key")!);
  clean.searchParams.set("token", url.searchParams.get("token")!);
  return clean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending review", OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done", CLOSED: "Closed",
};

// Card paragraphs support HTML. Feedback and names must stay plain text, including
// strings that resemble Google Chat mentions or links.
function escape(value: string, limit = 1_000): string {
  const text = value.length > limit ? value.slice(0, limit) + "…" : value;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>");
}

export function googleChatMessage(payload: IntegrationPayload, issueUrl: string) {
  const { feedback, project } = payload;
  let headline: string;
  let update: string;
  switch (payload.event) {
    case "ISSUE_SHARED":
      headline = "Issue discussion";
      update = "Reply in this thread to discuss this issue with your team.";
      break;
    case "NEW_FEEDBACK":
      headline = "New issue";
      update = "Reply in this thread to discuss this issue with your team.";
      break;
    case "STATUS_CHANGED":
      headline = "Status changed";
      update = `<b>Status:</b> ${escape(payload.oldStatusName ?? STATUS_LABEL[payload.oldStatus] ?? payload.oldStatus, 100)} → ${escape(payload.newStatusName ?? STATUS_LABEL[payload.newStatus] ?? payload.newStatus, 100)}`;
      break;
    case "NEW_COMMENT":
      headline = "New UpStep comment";
      update = `<b>${escape(payload.comment.authorName?.trim() || "UpStep Team", 100)}:</b><br>${escape(payload.comment.content)}`;
      break;
    case "NEW_VOTE":
      headline = payload.vote.value === "UP" ? "New upvote" : "New downvote";
      update = `<b>Votes:</b> ${payload.feedback.upvotes} up · ${payload.feedback.downvotes} down`;
      break;
  }
  return {
    text: `UpStep · ${headline}`,
    // A stable key keeps all selected events for one issue in the same thread.
    thread: { threadKey: `upstep:${project.id}:${feedback.id}` },
    cardsV2: [{
      cardId: "upstep-issue",
      card: {
        header: { title: headline, subtitle: "UpStep" },
        sections: [{ widgets: [
          { textParagraph: { text: `<b>${escape(feedback.title || feedback.content, 200)}</b><br>${escape(project.name, 100)} · ${escape(feedback.type, 30)}` } },
          { textParagraph: { text: escape(feedback.content) } },
          { textParagraph: { text: update } },
          { buttonList: { buttons: [{ text: "Open issue in UpStep", onClick: { openLink: { url: issueUrl } } }] } },
        ] }],
      },
    }],
  };
}

export async function sendGoogleChat(webhookUrl: string, payload: IntegrationPayload, issueUrl: string, requestId: string = randomUUID()) {
  const url = googleChatWebhookUrl(webhookUrl);
  url.searchParams.set("messageReplyOption", "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
  // Google Chat deduplicates identical requests, including queue retries after a
  // timeout or a failure at another integration destination.
  url.searchParams.set("requestId", requestId);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(googleChatMessage(payload, issueUrl)),
      signal: AbortSignal.timeout(8_000),
      redirect: "error",
    });
  } catch {
    // URLs contain credentials; never persist a fetch error that might expose one.
    throw new Error("Google Chat request failed or timed out.");
  }
  if (!response.ok) throw new Error(`Google Chat returned HTTP ${response.status}`);
}
