export type EmailTemplate = { name: string; subject: string; text: string; html: string };

/** Source copies of the published SendPanda templates, also used when self-hosting. */
export const EMAIL_TEMPLATES = {
  feedback: {
    name: "UpStep — Feedback notification",
    subject: "{{subject}}",
    text: `{{type_label}} on {{project_name}}

{{title}}

{{details}}
{{flags}}

{{action_label}}: {{dashboard_url}}

Best,
The UpStep Team

You're receiving this because you own the {{project_name}} project on UpStep.`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:18px;font-weight:700;color:#1a1915;letter-spacing:-0.5px;">UpStep</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e5e3dd;overflow:hidden;">
          <div style="padding:20px 24px 0;">
            <span style="display:inline-block;font-size:11px;font-weight:600;color:{{type_color}};background:{{type_color}}18;border:1px solid {{type_color}}30;border-radius:20px;padding:3px 10px;text-transform:uppercase;letter-spacing:0.5px;">{{type_label}}</span>
            <span style="display:{{flagged_display}};font-size:11px;font-weight:600;color:#d97706;background:#fef3c7;border:1px solid #fde68a;border-radius:20px;padding:3px 10px;margin-left:6px;">⚑ Flagged</span>
            <span style="display:{{pending_display}};font-size:11px;font-weight:600;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;padding:3px 10px;margin-left:6px;">Pending review</span>
          </div>
          <div style="padding:12px 24px 4px;">
            <p style="margin:0;font-size:17px;font-weight:600;color:#1a1915;line-height:1.4;">{{title}}</p>
          </div>
          <div style="display:{{details_display}};padding:0 24px 4px;">
            <p style="margin:0;font-size:14px;color:#6b6a65;line-height:1.6;">{{details}}</p>
          </div>
          <div style="padding:8px 24px 20px;">
            <p style="margin:0;font-size:12px;color:#9b9991;">Submitted to <strong style="color:#4a4945;">{{project_name}}</strong></p>
          </div>
          <div style="height:1px;background:#e5e3dd;"></div>
          <div style="padding:20px 24px;">
            <a href="{{dashboard_url}}" style="display:inline-block;background:#d97757;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">{{action_label}} →</a>
          </div>
        </td></tr>
        <tr><td style="padding-top:20px;">
          <p style="margin:0 0 12px;font-size:13px;color:#4a4945;text-align:center;">Best,<br><strong>The UpStep Team</strong></p>
          <p style="margin:0;font-size:12px;color:#9b9991;text-align:center;">You're receiving this because you own the <strong>{{project_name}}</strong> project on UpStep.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  },
  test: {
    name: "UpStep — Email setup test",
    subject: "Your UpStep email setup is ready",
    text: "Hello,\n\nThis test confirms that UpStep can send transactional emails through SendPanda.\n\nBest,\nThe UpStep Team",
    html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:40px 16px;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1915;">
  <div style="max-width:520px;margin:auto;">
    <h1 style="font-size:18px;">UpStep</h1>
    <div style="padding:24px;background:#fff;border:1px solid #e5e3dd;border-radius:16px;">
      <p>Hello,</p>
      <p>This test confirms that UpStep can send transactional emails through SendPanda.</p>
      <p>Best,<br><strong>The UpStep Team</strong></p>
    </div>
  </div>
</body></html>`,
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
