import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createSupportSession,
  authenticateSupportSession,
  startConversation,
  customerMessage,
} from "./support/service";
import { processAIConversation } from "./support/worker";
import type { SupportAIProvider } from "./support/ai";

const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test(
  "self-hosted installs give a Free account support chat and AI replies",
  { skip: !url },
  async () => {
    const db = new PrismaClient({ datasourceUrl: url! });
    const suffix = randomUUID();
    const owner = await db.user.create({
      data: { email: `self-hosted-${suffix}@example.test`, plan: "FREE" },
    });
    const project = await db.project.create({
      data: {
        name: "Acme",
        slug: `self-hosted-${suffix}`,
        ownerId: owner.id,
        supportConfig: {
          create: {
            enabled: true,
            domain: "example.com",
            businessName: "Acme",
            crawlState: "READY",
          },
        },
      },
    });
    const provider: SupportAIProvider = {
      async reply() {
        return {
          inScope: true,
          resolution: "answer",
          reply: "You can reset it from Settings.",
          sources: [],
          offerTicket: false,
          handoff: false,
          ticketTitle: "Reset",
          ticketType: "GENERAL",
        };
      },
    };
    const previous = process.env.UPSTEP_SELF_HOSTED;
    try {
      delete process.env.UPSTEP_SELF_HOSTED;
      await assert.rejects(
        createSupportSession(project.id, undefined, db),
        /paid plans/,
      );

      process.env.UPSTEP_SELF_HOSTED = "true";
      const session = await createSupportSession(project.id, undefined, db);
      const { customerId } = await authenticateSupportSession(
        project.id,
        session.token,
        db,
      );
      const c = await startConversation(project.id, customerId, db);
      await customerMessage(
        {
          projectId: project.id,
          customerId,
          conversationId: c.id,
          clientMessageId: randomUUID(),
          content: "How do I reset my password?",
        },
        db,
      );
      assert.equal(await processAIConversation(db, provider, project.id), true);
      const reply = await db.supportMessage.findFirst({
        where: { conversationId: c.id, role: "ASSISTANT" },
      });
      assert.equal(reply?.content, "You can reset it from Settings.");
    } finally {
      if (previous === undefined) delete process.env.UPSTEP_SELF_HOSTED;
      else process.env.UPSTEP_SELF_HOSTED = previous;
      await db.project.delete({ where: { id: project.id } });
      await db.user.delete({ where: { id: owner.id } });
      await db.$disconnect();
    }
  },
);
