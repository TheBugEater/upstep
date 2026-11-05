import type { IntegrationPayload } from "./integrations";

const INVALID_WEBHOOK = "Use a Google Chat webhook URL from https://chat.googleapis.com/v1/spaces/…/messages with its key and token.";

export class GoogleChatDeliveryError extends Error {
  readonly retryable: boolean;
  constructor(public readonly status: number | undefined, detail?: string) {
    super(status === undefined ? "Google Chat request failed or timed out." : `Google Chat returned HTTP ${status}${detail ? `: ${detail}` : ""}`);
    this.retryable = status === undefined || status === 408 || status === 429 || status >= 500;
  }
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
const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b", OPEN: "#94a3b8", IN_PROGRESS: "#3b82f6", DONE: "#22c55e", CLOSED: "#64748b",
};
const TYPE_LABEL: Record<string, string> = { BUG: "Bug report", FEATURE: "Feature request", GENERAL: "General feedback" };

function safeColor(value: string | undefined, fallback = "#94a3b8") {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function badge(name: string, color: string, limit = 100) {
  // Only the dot uses the exact board color; the name inherits Chat's readable
  // foreground in both themes, including for very light or dark label colors.
  return `<font color="${safeColor(color)}">●</font> <b>${escape(name, limit)}</b>`;
}

function buttonColor(hex: string) {
  const value = Number.parseInt(safeColor(hex).slice(1), 16);
  return { red: ((value >> 16) & 255) / 255, green: ((value >> 8) & 255) / 255, blue: (value & 255) / 255 };
}

type CardWidget =
  | { textParagraph: { text: string } }
  | { decoratedText: { topLabel: string; text: string; bottomLabel?: string; wrapText: boolean } }
  | { buttonList: { buttons: { text: string; color: ReturnType<typeof buttonColor>; onClick: { openLink: { url: string } }; altText: string }[] } };
type CardSection = { header?: string; widgets: CardWidget[] };

// Card paragraphs support HTML. Feedback and names must stay plain text, including
// strings that resemble Google Chat mentions or links.
function escape(value: string, limit = 1_000): string {
  const text = value.length > limit ? value.slice(0, limit) + "…" : value;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>");
}

export function googleChatMessage(payload: IntegrationPayload, issueUrl: string) {
  const { feedback, project } = payload;
  const title = (feedback.title?.trim() || feedback.content.trim() || "Untitled issue").replace(/\s+/g, " ");
  // Chat derives the thread preview from its first message. Use the issue title
  // there and in the card header, without turning title text into @mentions.
  const topic = (title.length > 200 ? title.slice(0, 200) + "…" : title).replace(/</g, "‹").replace(/>/g, "›");
  const lifecycle = payload.event === "STATUS_CHANGED" ? payload.newStatus : feedback.status;
  // Pending moderation has its own status even when a default board column exists.
  const statusName = payload.event === "STATUS_CHANGED"
    ? payload.newStatusName ?? STATUS_LABEL[payload.newStatus] ?? payload.newStatus
    : lifecycle === "PENDING" ? STATUS_LABEL.PENDING! : feedback.boardStatus?.name ?? STATUS_LABEL[lifecycle ?? ""] ?? "Open";
  const currentColor = payload.event === "STATUS_CHANGED"
    ? safeColor(payload.newStatusColor ?? (feedback.boardStatus?.name === statusName ? feedback.boardStatus.color : undefined), STATUS_COLOR[payload.newStatus])
    : safeColor(lifecycle === "PENDING" ? undefined : feedback.boardStatus?.color, STATUS_COLOR[lifecycle ?? ""]);
  let headline: string;
  const updates: CardWidget[] = [];
  switch (payload.event) {
    case "ISSUE_SHARED":
      headline = "Issue discussion";
      break;
    case "NEW_FEEDBACK":
      headline = "New issue";
      break;
    case "STATUS_CHANGED":
      headline = "Status changed";
      updates.push({ textParagraph: { text: `${badge(payload.oldStatusName ?? STATUS_LABEL[payload.oldStatus] ?? payload.oldStatus, safeColor(payload.oldStatusColor, STATUS_COLOR[payload.oldStatus]))} → ${badge(statusName, currentColor)}` } });
      break;
    case "NEW_COMMENT":
      headline = "New UpStep comment";
      updates.push({ decoratedText: { topLabel: "Comment by", text: escape(payload.comment.authorName?.trim() || "UpStep Team", 100), wrapText: true } });
      updates.push({ textParagraph: { text: escape(payload.comment.content, 1_600) } });
      break;
    case "NEW_VOTE":
      headline = payload.vote.value === "UP" ? "New upvote" : "New downvote";
      updates.push({ textParagraph: { text: `<b>${payload.feedback.upvotes}</b> upvotes · <b>${payload.feedback.downvotes}</b> downvotes` } });
      break;
  }
  const metadata: CardWidget[] = [{ decoratedText: {
    topLabel: `${project.name.slice(0, 100).replace(/[<>]/g, "")} · ${TYPE_LABEL[feedback.type] ?? feedback.type.slice(0, 30)}`,
    text: badge(statusName, currentColor),
    bottomLabel: `Assigned to ${feedback.assignee?.name?.trim().slice(0, 100) || (feedback.assignee ? "Teammate" : "Unassigned")}${feedback.internal ? " · Internal task" : ""}`.replace(/[<>]/g, ""),
    wrapText: true,
  } }];
  if (feedback.labels?.length) {
    const labels = feedback.labels.slice(0, 8).map((label) => badge(label.name, label.color, 50));
    if (feedback.labels.length > 8) labels.push(`+${feedback.labels.length - 8} more`);
    metadata.push({ decoratedText: { topLabel: "Labels", text: labels.join(" &nbsp; "), wrapText: true } });
  }
  const sections: CardSection[] = [{ widgets: metadata }];
  if (payload.event === "NEW_FEEDBACK" || payload.event === "ISSUE_SHARED") {
    if (feedback.content.trim()) sections.push({ header: "Description", widgets: [{ textParagraph: { text: escape(feedback.content, 1_200) } }] });
    sections.push({ widgets: [{ textParagraph: { text: "Reply in this thread to discuss this issue with your team." } }] });
  } else {
    // Replies focus on what changed instead of repeating the full description.
    sections.push({ header: headline, widgets: updates });
  }
  sections.push({ widgets: [{ buttonList: { buttons: [{
    text: "Open issue in UpStep", color: buttonColor(currentColor),
    onClick: { openLink: { url: issueUrl } }, altText: "Open this issue in UpStep",
  }] } }] });
  return {
    text: topic,
    // A stable key keeps all selected events for one issue in the same thread.
    thread: { threadKey: `upstep:${project.id}:${feedback.id}` },
    cardsV2: [{
      cardId: "upstep-issue",
      card: {
        header: { title: topic, subtitle: `UpStep · ${headline}` },
        sections,
      },
    }],
  };
}

export async function sendGoogleChat(webhookUrl: string, payload: IntegrationPayload, issueUrl: string) {
  const url = googleChatWebhookUrl(webhookUrl);
  url.searchParams.set("messageReplyOption", "REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD");
  // Incoming webhooks reject requestId even though the authenticated Chat API
  // supports it. Only send the documented webhook threading parameters.
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
    throw new GoogleChatDeliveryError(undefined);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
    let detail = typeof body?.error?.message === "string" ? body.error.message : "";
    for (const key of ["key", "token"]) {
      const secret = url.searchParams.get(key);
      if (secret) detail = detail.split(secret).join("[redacted]").split(encodeURIComponent(secret)).join("[redacted]");
    }
    detail = detail.replace(/https?:\/\/\S+/g, "[URL redacted]").slice(0, 500);
    throw new GoogleChatDeliveryError(response.status, detail);
  }
}
