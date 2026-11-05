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

type DecoratedWidget = { decoratedText: { topLabel: string; text: string; wrapText: boolean } };
type CardWidget =
  | { textParagraph: { text: string } }
  | DecoratedWidget
  | { columns: { columnItems: { horizontalSizeStyle: "FILL_AVAILABLE_SPACE"; widgets: DecoratedWidget[] }[] } }
  | { buttonList: { buttons: { text: string; color: ReturnType<typeof buttonColor>; onClick: { openLink: { url: string } }; altText: string }[] } };
type CollapseButton = { text: string; type: "BORDERLESS"; icon: { materialIcon: { name: string } } };
type CardSection = {
  widgets: CardWidget[];
  collapsible?: boolean;
  uncollapsibleWidgetsCount?: number;
  collapseControl?: { horizontalAlignment: "START"; expandButton: CollapseButton; collapseButton: CollapseButton };
};

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

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
  const assignee = singleLine(feedback.assignee?.name || "") || (feedback.assignee ? "Teammate" : "Unassigned");
  let headline: string;
  let preview: string;
  let detail: CardWidget;
  switch (payload.event) {
    case "ISSUE_SHARED":
    case "NEW_FEEDBACK":
      headline = payload.event === "ISSUE_SHARED" ? "Issue discussion" : "New issue";
      preview = escape(singleLine(feedback.content) || "No description yet.", 160);
      detail = { decoratedText: { topLabel: "Description", text: escape(feedback.content.trim() || "No description yet.", 2_400), wrapText: true } };
      break;
    case "STATUS_CHANGED": {
      headline = "Status changed";
      const previous = payload.oldStatusName ?? STATUS_LABEL[payload.oldStatus] ?? payload.oldStatus;
      const previousColor = safeColor(payload.oldStatusColor, STATUS_COLOR[payload.oldStatus]);
      preview = `${badge(singleLine(previous), previousColor, 40)} → ${badge(singleLine(statusName), currentColor, 40)}`;
      detail = { decoratedText: { topLabel: "Status transition", text: `${badge(previous, previousColor)} → ${badge(statusName, currentColor)}`, wrapText: true } };
      break;
    }
    case "NEW_COMMENT": {
      const author = singleLine(payload.comment.authorName || "") || "UpStep Team";
      headline = `Comment · ${author.slice(0, 80).replace(/[<>]/g, "")}`;
      preview = escape(singleLine(payload.comment.content), 160);
      // Task comments are limited to 2000 characters. Preserve the entire comment
      // behind the native disclosure, including evidence near the end of a note.
      detail = { decoratedText: { topLabel: "Full comment", text: `<b>${escape(author, 100)}</b><br>${escape(payload.comment.content, 2_000)}`, wrapText: true } };
      break;
    }
    case "NEW_VOTE":
      headline = payload.vote.value === "UP" ? "New upvote" : "New downvote";
      preview = `<b>${payload.feedback.upvotes}</b> upvotes · <b>${payload.feedback.downvotes}</b> downvotes`;
      detail = { textParagraph: { text: `${preview}<br>Reply in this thread to discuss this issue with your team.` } };
      break;
  }
  const labels = feedback.labels ?? [];
  const visibleLabels = labels.slice(0, 2).map((label) => badge(singleLine(label.name), label.color, 20));
  if (labels.length > 2) visibleLabels.push(`+${labels.length - 2} more`);
  const details: CardWidget[] = [detail];
  if (labels.length) {
    const allLabels = labels.slice(0, 8).map((label) => badge(label.name, label.color, 50));
    if (labels.length > 8) allLabels.push(`+${labels.length - 8} more in UpStep`);
    details.push({ decoratedText: { topLabel: "All labels", text: allLabels.join(" &nbsp; "), wrapText: true } });
  }
  details.push({ decoratedText: { topLabel: "Issue context", text: `${escape(project.name, 100)} · ${escape(TYPE_LABEL[feedback.type] ?? feedback.type, 30)}${feedback.internal ? " · Internal task" : ""}<br>${badge(statusName, currentColor)}<br>Assigned to ${escape(assignee, 100)}`, wrapText: true } });
  // Every event shares three single-line summary widgets. All variable-length
  // content lives after this boundary so comment size cannot grow a closed card.
  const sections: CardSection[] = [{
    collapsible: true,
    uncollapsibleWidgetsCount: 3,
    collapseControl: {
      horizontalAlignment: "START",
      expandButton: { text: "Show details", type: "BORDERLESS", icon: { materialIcon: { name: "expand_more" } } },
      collapseButton: { text: "Hide details", type: "BORDERLESS", icon: { materialIcon: { name: "expand_less" } } },
    },
    widgets: [
      { columns: { columnItems: [
        { horizontalSizeStyle: "FILL_AVAILABLE_SPACE", widgets: [{ decoratedText: { topLabel: "Status", text: badge(singleLine(statusName), currentColor), wrapText: false } }] },
        { horizontalSizeStyle: "FILL_AVAILABLE_SPACE", widgets: [{ decoratedText: { topLabel: "Assigned to", text: escape(assignee, 100), wrapText: false } }] },
      ] } },
      { decoratedText: { topLabel: "Labels", text: visibleLabels.join(" &nbsp; ") || "No labels", wrapText: false } },
      { decoratedText: { topLabel: headline, text: preview, wrapText: false } },
      ...details,
    ],
  }];
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
        header: { title: topic, subtitle: `${singleLine(project.name).slice(0, 80).replace(/[<>]/g, "")} · ${TYPE_LABEL[feedback.type] ?? singleLine(feedback.type).slice(0, 30)}${feedback.internal ? " · Internal task" : ""}` },
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
