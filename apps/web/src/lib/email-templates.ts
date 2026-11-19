export type EmailTemplate = { name: string; subject: string; text: string; html: string };

/** One email-safe brand shell shared by inline and published provider templates. */
function emailLayout(preview: string, content: string, footer: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#fafafa;color:#000000;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 0 24px;">
        <a href="https://upstep.dev" style="display:inline-block;color:#000000;text-decoration:none;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="40" style="vertical-align:middle;"><img src="https://upstep.dev/logo.png" alt="" width="36" height="36" style="display:block;border:0;border-radius:8px;"></td>
            <td style="padding-left:10px;vertical-align:middle;font-size:22px;font-weight:700;letter-spacing:-0.7px;">Upstep</td>
          </tr></table>
        </a>
      </td></tr>
      <tr><td style="padding:28px;background:#ffffff;border:1px solid #e5e5e5;border-top:3px solid #c9481f;border-radius:12px;overflow-wrap:anywhere;">
        ${content}
        <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:#525252;">Best,<br><strong style="color:#000000;">The Upstep Team</strong></p>
      </td></tr>
      <tr><td style="padding:24px 8px 0;">
        <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#525252;">Feedback that moves you forward.</p>
        <p style="margin:0 0 14px;font-size:12px;line-height:1.7;color:#6b6b6b;">${footer}</p>
        <p style="margin:0;font-size:12px;line-height:1.7;"><a href="https://upstep.dev" style="color:#525252;">upstep.dev</a> &nbsp;·&nbsp; <a href="https://upstep.dev/legal/privacy" style="color:#525252;">Privacy</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

function emailButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td bgcolor="#c9481f" style="border-radius:8px;text-align:center;">
    <a href="${url}" style="display:inline-block;border:1px solid #c9481f;border-radius:8px;padding:12px 20px;color:#ffffff;font-size:14px;line-height:1.4;font-weight:700;text-decoration:none;">${label} →</a>
  </td></tr></table>`;
}

const preferencesFooter = `You're receiving this because of your email settings for <strong>{{project_name}}</strong>. <a href="{{settings_url}}" style="color:#525252;">Change what you receive</a>.`;
const textSignature = "Best,\nThe Upstep Team";
const textBrandFooter = "Upstep · Feedback that moves you forward.\nhttps://upstep.dev";

/** Keep existing provider template names so sync updates their version history. */
export const EMAIL_TEMPLATES = {
  feedback: {
    name: "UpStep — Feedback notification",
    subject: "{{subject}}",
    text: `{{type_label}} on {{project_name}}

{{title}}

{{details}}
{{flags}}

{{action_label}}: {{dashboard_url}}

${textSignature}

You're receiving this because of your email settings for {{project_name}}.
Change what you receive: {{settings_url}}

${textBrandFooter}`,
    html: emailLayout("{{type_label}} on {{project_name}}: {{title}}", `
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;line-height:1.6;text-transform:uppercase;letter-spacing:0.6px;color:{{type_color}};">{{type_label}}</p>
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.35;letter-spacing:-0.5px;">{{title}}</h1>
      <p style="display:{{details_display}};margin:0 0 18px;font-size:15px;line-height:1.7;color:#525252;white-space:pre-wrap;">{{details}}</p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#525252;">Submitted to <strong style="color:#000000;">{{project_name}}</strong></p>
      <p style="display:{{flagged_display}};margin:0 0 8px;font-size:12px;line-height:1.6;color:#b06206;">⚑ Flagged</p>
      <p style="display:{{pending_display}};margin:0;font-size:12px;line-height:1.6;color:#963415;">Pending review</p>
      ${emailButton("{{dashboard_url}}", "{{action_label}}")}`, preferencesFooter),
  },
  invitation: {
    name: "UpStep — Project invitation",
    subject: "You're invited to {{project_name}} on Upstep",
    text: `Hi {{recipient_name}},

{{inviter_name}} invited you to the {{project_name}} project on Upstep.

Accept the invitation to view and triage the project's feedback.
New to Upstep? Continuing with Google or GitHub creates your account automatically.
Use the email address this message was sent to. This link expires in seven days.

Accept invitation: {{invitation_url}}

${textSignature}

If you weren't expecting this, you can ignore this email.

${textBrandFooter}`,
    html: emailLayout("{{inviter_name}} invited you to {{project_name}} on Upstep.", `
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#c9481f;">Project invitation</p>
      <h1 style="margin:0 0 24px;font-size:26px;line-height:1.3;letter-spacing:-0.5px;">You're invited to the team</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi {{recipient_name}},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;"><strong>{{inviter_name}}</strong> invited you to the <strong>{{project_name}}</strong> project on Upstep.</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#525252;">Accept the invitation to view and triage the project's feedback. New to Upstep? Continuing with Google or GitHub creates your account automatically. Use the email address this message was sent to.</p>
      ${emailButton("{{invitation_url}}", "Accept invitation")}
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b6b6b;">This link expires in seven days.</p>`, "If you weren't expecting this invitation, you can ignore this email."),
  },
  activity: {
    name: "UpStep — Task activity",
    subject: "{{subject}}",
    text: `{{headline}}

{{task_title}}

{{detail}}

Open the task: {{task_url}}

${textSignature}

You're receiving this because of your email settings for {{project_name}}.
Change what you receive: {{settings_url}}

${textBrandFooter}`,
    html: emailLayout("{{headline}}: {{task_title}}", `
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#c9481f;">Task activity</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#525252;">{{headline}}</p>
      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.35;letter-spacing:-0.5px;">{{task_title}}</h1>
      <p style="display:{{detail_display}};margin:0;padding:16px;border-left:3px solid #c9481f;background:#fdf0ea;font-size:14px;line-height:1.7;color:#333333;white-space:pre-wrap;">{{detail}}</p>
      ${emailButton("{{task_url}}", "Open the task")}`, preferencesFooter),
  },
  test: {
    name: "UpStep — Email setup test",
    subject: "Your Upstep email setup is ready",
    text: `Hello,

Your Upstep email setup is ready. This test confirms that Upstep can send transactional emails through SendPanda.

Open your dashboard: https://upstep.dev/dashboard

${textSignature}

${textBrandFooter}`,
    html: emailLayout("Your Upstep email setup is ready.", `
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:#c9481f;">Email connected</p>
      <h1 style="margin:0 0 24px;font-size:26px;line-height:1.3;letter-spacing:-0.5px;">Your email setup is ready</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hello,</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#525252;">This test confirms that Upstep can send transactional emails through SendPanda.</p>
      ${emailButton("https://upstep.dev/dashboard", "Open your dashboard")}`, "You're receiving this because an email setup test was requested for Upstep."),
  },
} satisfies Record<string, EmailTemplate>;

/** SendPanda uses escaped {{variable}} substitution in HTML and plain text elsewhere. */
export function renderEmailTemplate(template: EmailTemplate, variables: Record<string, string>) {
  function substitute(source: string, html: boolean): string {
    return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match: string, key: string) => {
      const value = variables[key];
      if (value === undefined) throw new Error(`Missing email template variable: ${key}`);
      return html ? value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[character]!) : value;
    });
  }
  const subject = substitute(template.subject, false);
  if (/[\r\n]/.test(subject)) throw new Error("Invalid email subject");
  return { subject, text: substitute(template.text, false), html: substitute(template.html, true) };
}
