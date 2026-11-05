import { randomUUID } from "node:crypto";
import { EMAIL_TEMPLATES, renderEmailTemplate } from "./email-templates";
import { getSiteUrl } from "./site-url";

export type EmailPayload = {
  to: string | string[];
  /** Reuse this UUID when retrying the same logical email. */
  idempotencyKey?: string;
} & (
  | { subject: string; text: string; html?: string; templateId?: never; variables?: never }
  | { templateId: string; variables: Record<string, string>; subject?: never; text?: never; html?: never }
);

/** A successful response confirms queuing, not delivery. Server-side only. */
export async function sendEmail({
  to,
  idempotencyKey = randomUUID(),
  ...content
}: EmailPayload): Promise<void> {
  const apiKey = process.env.SENDPANDA_API_KEY;
  if (!apiKey) throw new Error("SENDPANDA_API_KEY is not configured.");

  const response = await fetch("https://api.sendpanda.email/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.SENDPANDA_FROM_EMAIL || "UpStep Team <hello@your-verified-domain.example>",
      to: Array.isArray(to) ? to : [to],
      ...(content.templateId
        ? { template_id: content.templateId, variables: content.variables }
        : { subject: content.subject, text: content.text, html: content.html }),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`SendPanda request failed (${response.status}): ${body}`);
  }
}

const TYPE_LABEL: Record<string, string> = {
  BUG: "Bug report",
  FEATURE: "Feature request",
  GENERAL: "General feedback",
};

const TYPE_COLOR: Record<string, string> = {
  BUG: "#ef4444",
  FEATURE: "#3b82f6",
  GENERAL: "#6b7280",
};

export type FeedbackNotificationPayload = {
  idempotencyKey?: string;
  toEmail: string;
  projectName: string;
  projectId: string;
  feedback: {
    title: string | null;
    content: string;
    type: string;
    flagged: boolean;
    status: string;
  };
};

export async function sendFeedbackNotification({
  idempotencyKey,
  toEmail,
  projectName,
  projectId,
  feedback,
}: FeedbackNotificationPayload) {
  // Preserve optional email notifications when no provider is configured.
  if (!process.env.SENDPANDA_API_KEY) return;

  const baseUrl = getSiteUrl();
  const dashboardUrl = `${baseUrl}/dashboard/projects/${projectId}`;

  const typeLabel = TYPE_LABEL[feedback.type] ?? feedback.type;
  const typeColor = TYPE_COLOR[feedback.type] ?? "#6b7280";
  const displayTitle = feedback.title ?? feedback.content.slice(0, 80) + (feedback.content.length > 80 ? "…" : "");
  const isPending = feedback.status === "PENDING";
  const subject = `New ${typeLabel.toLowerCase()} on ${projectName}`;

  const showDetails = Boolean(feedback.title && feedback.content !== feedback.title);
  const variables = {
    subject,
    type_label: typeLabel,
    type_color: typeColor,
    title: displayTitle,
    details: showDetails ? feedback.content.slice(0, 300) + (feedback.content.length > 300 ? "…" : "") : "",
    details_display: showDetails ? "block" : "none",
    flagged_display: feedback.flagged ? "inline-block" : "none",
    pending_display: isPending ? "inline-block" : "none",
    flags: [feedback.flagged ? "Flagged" : "", isPending ? "Pending review" : ""].filter(Boolean).join("\n"),
    project_name: projectName,
    dashboard_url: dashboardUrl,
    action_label: isPending ? "Review in dashboard" : "View in dashboard",
  };
  const templateId = process.env.SENDPANDA_FEEDBACK_TEMPLATE_ID;
  await sendEmail({
    to: toEmail,
    ...(templateId ? { templateId, variables } : renderEmailTemplate(EMAIL_TEMPLATES.feedback, variables)),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}
