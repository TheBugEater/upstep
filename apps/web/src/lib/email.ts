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
  kind?: "FEEDBACK";
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

export type ProjectInvitationPayload = {
  kind: "PROJECT_INVITATION";
  invitationId: string;
  token: string;
  idempotencyKey?: string;
  toEmail: string;
  recipientName: string | null;
  inviterName: string | null;
  projectName: string;
  projectId: string;
};

/** Something happened on a task the recipient asked to hear about. */
export type TaskActivityPayload = {
  kind: "TASK_ACTIVITY";
  event: "ASSIGNED" | "COMMENT" | "STATUS";
  idempotencyKey?: string;
  toEmail: string;
  projectName: string;
  projectId: string;
  taskId: string;
  taskTitle: string;
  actorName: string;
  /** The comment text, or "Open → Planned" for a status change. */
  detail?: string;
};

export type EmailNotificationPayload = FeedbackNotificationPayload | ProjectInvitationPayload | TaskActivityPayload;

export function emailSettingsUrl(projectId: string) {
  return `${getSiteUrl()}/dashboard/projects/${encodeURIComponent(projectId)}?tab=settings&panel=email`;
}

export function taskActivityEmail(payload: TaskActivityPayload) {
  const task = payload.taskTitle.length > 120 ? `${payload.taskTitle.slice(0, 120)}…` : payload.taskTitle;
  const actor = payload.actorName.trim() || "A teammate";
  const headline = payload.event === "ASSIGNED" ? `${actor} assigned you a task in ${payload.projectName}`
    : payload.event === "COMMENT" ? `${actor} commented on your task in ${payload.projectName}`
    : `${actor} changed the status of your task in ${payload.projectName}`;
  const subject = payload.event === "ASSIGNED" ? `Assigned to you: ${task}`
    : payload.event === "COMMENT" ? `New comment: ${task}`
    : `Status changed: ${task}`;
  const detail = (payload.detail ?? "").slice(0, 600);
  return renderEmailTemplate(EMAIL_TEMPLATES.activity, {
    subject: subject.replace(/[\r\n]+/g, " "),
    headline,
    task_title: task,
    detail,
    detail_display: detail ? "block" : "none",
    task_url: `${getSiteUrl()}/dashboard/projects/${encodeURIComponent(payload.projectId)}/tasks/${encodeURIComponent(payload.taskId)}`,
    project_name: payload.projectName,
    settings_url: emailSettingsUrl(payload.projectId),
  });
}

export async function sendTaskActivityNotification(payload: TaskActivityPayload) {
  // Like feedback alerts, activity emails are optional without a provider.
  if (!process.env.SENDPANDA_API_KEY) return;
  await sendEmail({
    to: payload.toEmail,
    ...taskActivityEmail(payload),
    ...(payload.idempotencyKey === undefined ? {} : { idempotencyKey: payload.idempotencyKey }),
  });
}

export async function sendProjectInvitationNotification({
  idempotencyKey,
  toEmail,
  recipientName,
  inviterName,
  projectName,
  token,
}: ProjectInvitationPayload) {
  const variables = {
    recipient_name: recipientName?.trim() || "there",
    inviter_name: inviterName?.trim() || "Your project owner",
    project_name: projectName,
    invitation_url: `${getSiteUrl()}/api/invitations/open?token=${encodeURIComponent(token)}`,
  };
  const templateId = process.env.SENDPANDA_INVITATION_TEMPLATE_ID;
  // Unlike optional feedback alerts, never silently complete an unsent invitation.
  await sendEmail({
    to: toEmail,
    ...(templateId ? { templateId, variables } : renderEmailTemplate(EMAIL_TEMPLATES.invitation, variables)),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}

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
    settings_url: emailSettingsUrl(projectId),
  };
  const templateId = process.env.SENDPANDA_FEEDBACK_TEMPLATE_ID;
  await sendEmail({
    to: toEmail,
    ...(templateId ? { templateId, variables } : renderEmailTemplate(EMAIL_TEMPLATES.feedback, variables)),
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
}
