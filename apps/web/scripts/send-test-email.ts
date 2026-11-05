import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { sendEmail, sendProjectInvitationNotification } from "../src/lib/email";
import { EMAIL_TEMPLATES, renderEmailTemplate } from "../src/lib/email-templates";
import { generateInvitationToken } from "../src/lib/invitation-tokens";

// Match Next.js environment precedence, including .env.local and shell values.
loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)), true);

async function main() {
  if (process.argv.includes("--invitation")) {
    await sendProjectInvitationNotification({
      kind: "PROJECT_INVITATION",
      invitationId: "preview-only",
      token: generateInvitationToken(),
      toEmail: "businesscodepulse@gmail.com",
      recipientName: "there",
      inviterName: "UpStep Team (template test)",
      projectName: "Invitation email test — preview only",
      projectId: "invitation-email-test-preview",
    });
    console.log("SendPanda accepted the invitation template test for queuing. This is a preview only; no project access was changed.");
    return;
  }
  const templateId = process.env.SENDPANDA_TEST_TEMPLATE_ID;
  await sendEmail({
    to: "businesscodepulse@gmail.com",
    ...(templateId ? { templateId, variables: {} } : renderEmailTemplate(EMAIL_TEMPLATES.test, {})),
  });
  console.log("SendPanda accepted the test email for queuing. This does not confirm delivery.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
