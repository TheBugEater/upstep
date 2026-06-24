import { db } from "./db";

// ─── Payload shapes ────────────────────────────────────────────────────────────

type ProjectInfo = { id: string; name: string };
type FeedbackInfo = { id: string; title: string | null; content: string; type: string; status?: string; flagged?: boolean };

export type IntegrationPayload =
  | { event: "NEW_FEEDBACK";   project: ProjectInfo; feedback: FeedbackInfo }
  | { event: "STATUS_CHANGED"; project: ProjectInfo; feedback: FeedbackInfo; oldStatus: string; newStatus: string }
  | { event: "NEW_VOTE";       project: ProjectInfo; feedback: FeedbackInfo & { upvotes: number; downvotes: number }; vote: { value: string } }
  | { event: "NEW_COMMENT";    project: ProjectInfo; feedback: FeedbackInfo; comment: { content: string; authorName: string | null } };

// ─── Entry point ───────────────────────────────────────────────────────────────

export async function triggerIntegrations(payload: IntegrationPayload): Promise<void> {
  const project = await db.project.findUnique({
    where: { id: payload.project.id },
    select: {
      owner: { select: { plan: true } },
      integrations: {
        where: { enabled: true, events: { has: payload.event } },
      },
    },
  });

  if (!project || !["PRO", "BUSINESS"].includes(project.owner.plan)) return;
  if (!project.integrations.length) return;

  const baseUrl = (process.env.AUTH_URL ?? "https://upstep.dev").replace(/\/$/, "");
  const dashboardUrl = `${baseUrl}/dashboard/projects/${payload.project.id}`;

  await Promise.allSettled(
    project.integrations.map((integration) => {
      switch (integration.type) {
        case "SLACK":
          return sendSlack(integration.webhookUrl, payload, dashboardUrl);
        case "DISCORD":
          return sendDiscord(integration.webhookUrl, payload, dashboardUrl);
        case "WEBHOOK":
          return sendWebhook(integration.webhookUrl, payload, dashboardUrl);
      }
    })
  );
}

// ─── Slack ─────────────────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = { BUG: "🐛", FEATURE: "✨", GENERAL: "💬" };
const TYPE_LABEL: Record<string, string> = { BUG: "Bug report", FEATURE: "Feature request", GENERAL: "General feedback" };
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending review", OPEN: "Open", IN_PROGRESS: "In progress", DONE: "Done", CLOSED: "Closed",
};

function feedbackTitle(f: FeedbackInfo): string {
  return f.title ?? (f.content.length > 80 ? f.content.slice(0, 80) + "…" : f.content);
}

async function sendSlack(url: string, payload: IntegrationPayload, dashboardUrl: string) {
  let text: string;
  let blocks: unknown[];

  if (payload.event === "NEW_FEEDBACK") {
    const { project, feedback } = payload;
    const emoji = TYPE_EMOJI[feedback.type] ?? "💬";
    const label = TYPE_LABEL[feedback.type] ?? feedback.type;
    text = `${emoji} New ${label.toLowerCase()} on *${project.name}*`;
    blocks = [
      { type: "section", text: { type: "mrkdwn", text: `${emoji} *New ${label}* on *${project.name}*` } },
      { type: "section", text: { type: "mrkdwn", text: `> ${feedbackTitle(feedback)}` } },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View in Upstep →" }, url: dashboardUrl }],
      },
    ];
  } else if (payload.event === "STATUS_CHANGED") {
    const { project, feedback, oldStatus, newStatus } = payload;
    text = `🔄 Status changed on *${project.name}*`;
    blocks = [
      { type: "section", text: { type: "mrkdwn", text: `🔄 Status changed on *${project.name}*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Feedback*\n${feedbackTitle(feedback)}` },
          { type: "mrkdwn", text: `*Status*\n${STATUS_LABEL[oldStatus] ?? oldStatus} → ${STATUS_LABEL[newStatus] ?? newStatus}` },
        ],
      },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View in Upstep →" }, url: dashboardUrl }],
      },
    ];
  } else if (payload.event === "NEW_VOTE") {
    const { project, feedback, vote } = payload;
    const voteLabel = vote.value === "UP" ? "👍 Upvoted" : "👎 Downvoted";
    text = `${voteLabel} on *${project.name}*`;
    blocks = [
      { type: "section", text: { type: "mrkdwn", text: `${voteLabel} on *${project.name}*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Feedback*\n${feedbackTitle(feedback)}` },
          { type: "mrkdwn", text: `*Votes*\n👍 ${feedback.upvotes}  👎 ${feedback.downvotes}` },
        ],
      },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View in Upstep →" }, url: dashboardUrl }],
      },
    ];
  } else {
    const { project, feedback, comment } = payload;
    text = `💬 New comment on *${project.name}*`;
    blocks = [
      { type: "section", text: { type: "mrkdwn", text: `💬 New comment on *${project.name}*` } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Feedback*\n${feedbackTitle(feedback)}` },
          { type: "mrkdwn", text: `*Comment*\n${comment.content.slice(0, 200)}` },
        ],
      },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View in Upstep →" }, url: dashboardUrl }],
      },
    ];
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, blocks }),
  });
}

// ─── Discord ───────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, number> = {
  BUG: 0xef4444,
  FEATURE: 0x3b82f6,
  GENERAL: 0x6b7280,
};

async function sendDiscord(url: string, payload: IntegrationPayload, dashboardUrl: string) {
  let title: string;
  let description: string;
  let color: number;
  let fields: { name: string; value: string; inline?: boolean }[] = [];

  if (payload.event === "NEW_FEEDBACK") {
    const { project, feedback } = payload;
    title = `${TYPE_EMOJI[feedback.type] ?? "💬"} New ${TYPE_LABEL[feedback.type] ?? "Feedback"}`;
    description = feedbackTitle(feedback);
    color = TYPE_COLOR[feedback.type] ?? 0x6b7280;
    fields = [
      { name: "Project", value: project.name, inline: true },
      { name: "Type", value: TYPE_LABEL[feedback.type] ?? feedback.type, inline: true },
    ];
    if (feedback.flagged) fields.push({ name: "⚑ Flagged", value: "Yes", inline: true });
  } else if (payload.event === "STATUS_CHANGED") {
    const { project, feedback, oldStatus, newStatus } = payload;
    title = "🔄 Status Changed";
    description = feedbackTitle(feedback);
    color = 0xf97316;
    fields = [
      { name: "Project", value: project.name, inline: true },
      { name: "Status", value: `${STATUS_LABEL[oldStatus] ?? oldStatus} → ${STATUS_LABEL[newStatus] ?? newStatus}`, inline: true },
    ];
  } else if (payload.event === "NEW_VOTE") {
    const { project, feedback, vote } = payload;
    title = vote.value === "UP" ? "👍 New Upvote" : "👎 New Downvote";
    description = feedbackTitle(feedback);
    color = 0x3b82f6;
    fields = [
      { name: "Project", value: project.name, inline: true },
      { name: "Votes", value: `👍 ${feedback.upvotes}  👎 ${feedback.downvotes}`, inline: true },
    ];
  } else {
    const { project, feedback, comment } = payload;
    title = "💬 New Comment";
    description = `**Feedback:** ${feedbackTitle(feedback)}\n\n${comment.content.slice(0, 300)}`;
    color = 0x8b5cf6;
    fields = [{ name: "Project", value: project.name, inline: true }];
    if (comment.authorName) fields.push({ name: "Author", value: comment.authorName, inline: true });
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Upstep",
      embeds: [{ title, description, color, fields, url: dashboardUrl }],
    }),
  });
}

// ─── Generic webhook ───────────────────────────────────────────────────────────

async function sendWebhook(url: string, payload: IntegrationPayload, dashboardUrl: string) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, dashboardUrl, timestamp: new Date().toISOString() }),
  });
}
