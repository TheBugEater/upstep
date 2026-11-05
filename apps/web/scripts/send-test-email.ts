import { loadEnvConfig } from "@next/env";
import { fileURLToPath } from "node:url";
import { sendEmail } from "../src/lib/email";
import { EMAIL_TEMPLATES, renderEmailTemplate } from "../src/lib/email-templates";

// Match Next.js environment precedence, including .env.local and shell values.
loadEnvConfig(fileURLToPath(new URL("..", import.meta.url)), true);

async function main() {
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
