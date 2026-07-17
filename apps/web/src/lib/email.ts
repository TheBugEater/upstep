import { Resend } from "resend";

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
  toEmail,
  projectName,
  projectId,
  feedback,
}: FeedbackNotificationPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "Upstep <notifications@upstep.app>";
  const baseUrl = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const dashboardUrl = `${baseUrl}/dashboard/projects/${projectId}`;

  const typeLabel = TYPE_LABEL[feedback.type] ?? feedback.type;
  const typeColor = TYPE_COLOR[feedback.type] ?? "#6b7280";
  const displayTitle = feedback.title ?? feedback.content.slice(0, 80) + (feedback.content.length > 80 ? "…" : "");
  const isPending = feedback.status === "PENDING";
  const subject = `New ${typeLabel.toLowerCase()} on ${projectName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo / header -->
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:18px;font-weight:700;color:#1a1915;letter-spacing:-0.5px;">Upstep</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e5e3dd;overflow:hidden;">

          <!-- Type badge row -->
          <div style="padding:20px 24px 0;">
            <span style="display:inline-block;font-size:11px;font-weight:600;color:${typeColor};background:${typeColor}18;border:1px solid ${typeColor}30;border-radius:20px;padding:3px 10px;text-transform:uppercase;letter-spacing:0.5px;">
              ${typeLabel}
            </span>
            ${feedback.flagged ? '<span style="display:inline-block;font-size:11px;font-weight:600;color:#d97706;background:#fef3c7;border:1px solid #fde68a;border-radius:20px;padding:3px 10px;margin-left:6px;">⚑ Flagged</span>' : ""}
            ${isPending ? '<span style="display:inline-block;font-size:11px;font-weight:600;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 10px;margin-left:6px;">Pending review</span>' : ""}
          </div>

          <!-- Title -->
          <div style="padding:12px 24px 4px;">
            <p style="margin:0;font-size:17px;font-weight:600;color:#1a1915;line-height:1.4;">${escapeHtml(displayTitle)}</p>
          </div>

          <!-- Content (only if title is separate) -->
          ${feedback.title && feedback.content !== feedback.title ? `
          <div style="padding:0 24px 4px;">
            <p style="margin:0;font-size:14px;color:#6b6a65;line-height:1.6;">${escapeHtml(feedback.content.slice(0, 300))}${feedback.content.length > 300 ? "…" : ""}</p>
          </div>` : ""}

          <!-- Project label -->
          <div style="padding:8px 24px 20px;">
            <p style="margin:0;font-size:12px;color:#9b9991;">Submitted to <strong style="color:#4a4945;">${escapeHtml(projectName)}</strong></p>
          </div>

          <!-- Divider -->
          <div style="height:1px;background:#e5e3dd;"></div>

          <!-- CTA -->
          <div style="padding:20px 24px;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#d97757;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">
              ${isPending ? "Review in dashboard →" : "View in dashboard →"}
            </a>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:20px;">
          <p style="margin:0;font-size:12px;color:#9b9991;text-align:center;">
            You're receiving this because you own the <strong>${escapeHtml(projectName)}</strong> project on Upstep.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await resend.emails.send({ from, to: toEmail, subject, html });
  if (result.error) throw new Error(`Resend delivery failed: ${result.error.message}`);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
