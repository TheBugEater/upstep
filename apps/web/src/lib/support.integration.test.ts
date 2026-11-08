import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createSupportSession,
  authenticateSupportSession,
  startConversation,
  customerMessage,
  createSupportTicket,
  requestHuman,
  teamConversationAction,
  availableAgents,
  supportProject,
} from "./support/service";
import { processAIConversation } from "./support/worker";
import type { SupportAIProvider } from "./support/ai";
import { hashSupportToken } from "./support/identity";
const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;
test(
  "private support: identities, AI, human takeover, private tickets and billing boundaries",
  { skip: !url },
  async (t) => {
    const db = new PrismaClient({ datasourceUrl: url! });
    const suffix = randomUUID();
    const owner = await db.user.create({
      data: {
        name: "Morgan Owner",
        email: `support-${suffix}@example.test`,
        plan: "PRO",
      },
    });
    const member = await db.user.create({
      data: {
        name: "Alex Support",
        email: `support-member-${suffix}@example.test`,
      },
    });
    const project = await db.project.create({
      data: {
        name: "Acme",
        slug: `support-${suffix}`,
        ownerId: owner.id,
        members: { create: { userId: member.id } },
        supportConfig: {
          create: {
            enabled: true,
            domain: "example.com",
            businessName: "Acme",
            supportEmail: "support@example.com",
            crawlState: "READY",
          },
        },
      },
    });
    const other = await db.project.create({
      data: { name: "Other", slug: `other-${suffix}`, ownerId: owner.id },
    });
    const provider: SupportAIProvider = {
      async reply(input) {
        assert.equal(input.businessName, "Acme");
        assert.ok(input.sources.every((s) => !s.content.includes("600 days")));
        assert.match(input.sources[0]!.content, /30 days/);
        return {
          reply: "Returns are accepted within 30 days.",
          sources: [0],
          offerTicket: true,
          handoff: false,
          ticketTitle: "Return request",
          ticketType: "GENERAL",
          inScope: true,
        };
      },
    };
    await db.supportKnowledgePage.create({
      data: {
        projectId: other.id,
        generation: 1,
        url: "https://other.example/private",
        title: "Returns",
        content: "Secret foreign company returns are within 600 days.",
      },
    });
    const session = await createSupportSession(project.id, undefined, db);
    const sessionTwo = await createSupportSession(project.id, undefined, db);
    const a = await authenticateSupportSession(project.id, session.token, db);
    const b = await authenticateSupportSession(
      project.id,
      sessionTwo.token,
      db,
    );
    try {
      await t.test(
        "sessions store only hashed tokens and cannot cross project boundaries",
        async () => {
          assert.equal(
            (
              await db.supportSession.findFirstOrThrow({
                where: { customerId: a.customerId },
              })
            ).tokenHash,
            hashSupportToken(session.token),
          );
          await assert.rejects(
            authenticateSupportSession(other.id, session.token, db),
          );
        },
      );
      const c = await startConversation(project.id, a.customerId, db);
      const otherC = await startConversation(project.id, b.customerId, db);
      await db.supportKnowledgePage.create({
        data: {
          projectId: project.id,
          generation: 1,
          url: "https://example.com/returns",
          title: "Returns",
          content: "Returns are accepted within 30 days.",
        },
      });
      await t.test(
        "client retries create one message and AI replies with real knowledge citations",
        async () => {
          const input = {
            projectId: project.id,
            customerId: a.customerId,
            conversationId: c.id,
            clientMessageId: randomUUID(),
            content: "How do I return this?",
          };
          await Promise.all([
            customerMessage(input, db),
            customerMessage(input, db),
          ]);
          assert.equal(
            await db.supportMessage.count({
              where: { conversationId: c.id, role: "CUSTOMER" },
            }),
            1,
          );
          await assert.rejects(
            customerMessage(
              {
                ...input,
                customerId: b.customerId,
                clientMessageId: randomUUID(),
              },
              db,
            ),
          );
          await processAIConversation(db, provider, project.id);
          const reply = await db.supportMessage.findFirstOrThrow({
            where: { conversationId: c.id, role: "ASSISTANT" },
          });
          assert.equal(reply.authorName, "Acme AI");
          assert.match(JSON.stringify(reply.metadata), /example.com\/returns/);
        },
      );
      await t.test(
        "automatic escalation reuses one private ticket and follows the support assignee",
        async () => {
          await teamConversationAction(
            {
              projectId: project.id,
              conversationId: c.id,
              actorId: member.id,
              action: "takeover",
            },
            db,
          );
          const tickets = await Promise.all([
            createSupportTicket(project.id, c.id, db),
            createSupportTicket(project.id, c.id, db),
          ]);
          assert.equal(tickets[0]!.ticketId, tickets[1]!.ticketId);
          const f = await db.feedback.findUniqueOrThrow({
            where: { id: tickets[0]!.ticketId },
          });
          assert.equal(f.internal, true);
          assert.equal(f.assigneeId, member.id);
        },
      );
      await t.test(
        "human takeover discards a response generated concurrently",
        async () => {
          await customerMessage(
            {
              projectId: project.id,
              customerId: b.customerId,
              conversationId: otherC.id,
              clientMessageId: randomUUID(),
              content: "Please help",
            },
            db,
          );
          const delayed: SupportAIProvider = {
            async reply(input) {
              await teamConversationAction(
                {
                  projectId: project.id,
                  conversationId: otherC.id,
                  actorId: member.id,
                  action: "takeover",
                },
                db,
              );
              return provider.reply(input);
            },
          };
          await processAIConversation(db, delayed, project.id);
          assert.equal(
            await db.supportMessage.count({
              where: { conversationId: otherC.id, role: "ASSISTANT" },
            }),
            0,
          );
          assert.equal(
            (
              await db.supportConversation.findUniqueOrThrow({
                where: { id: otherC.id },
              })
            ).state,
            "HUMAN",
          );
          await teamConversationAction(
            {
              projectId: project.id,
              conversationId: otherC.id,
              actorId: member.id,
              action: "note",
              clientMessageId: randomUUID(),
              content: "Private account context",
            },
            db,
          );
          assert.equal(
            await db.supportMessage.count({
              where: { conversationId: otherC.id, role: "NOTE" },
            }),
            1,
          );
        },
      );
      await t.test(
        "presence expires; humans stop AI; removed members cannot reply",
        async () => {
          await db.supportPresence.create({
            data: {
              projectId: project.id,
              userId: member.id,
              available: true,
              lastSeenAt: new Date(Date.now() - 120_000),
            },
          });
          assert.equal((await availableAgents(project.id, db)).length, 0);
          await requestHuman(project.id, c.id, a.customerId, db);
          assert.notEqual(
            (
              await db.supportConversation.findUniqueOrThrow({
                where: { id: c.id },
              })
            ).state,
            "AI",
          );
          await db.projectMember.deleteMany({
            where: { projectId: project.id, userId: member.id },
          });
          await assert.rejects(
            teamConversationAction(
              {
                projectId: project.id,
                conversationId: c.id,
                actorId: member.id,
                action: "reply",
                content: "Not authorized",
                clientMessageId: randomUUID(),
              },
              db,
            ),
          );
        },
      );
      await t.test(
        "Free plans are rejected, and exhausted AI allowance routes to the team",
        async () => {
          await db.user.update({
            where: { id: owner.id },
            data: { plan: "FREE" },
          });
          await assert.rejects(supportProject(project.id, db));
          await db.user.update({
            where: { id: owner.id },
            data: { plan: "PRO" },
          });
          const month = new Date().toISOString().slice(0, 7);
          await db.supportUsage.upsert({
            where: { ownerId_month: { ownerId: owner.id, month } },
            create: { ownerId: owner.id, month, aiReplies: 300 },
            update: { aiReplies: 300 },
          });
          await teamConversationAction(
            {
              projectId: project.id,
              conversationId: otherC.id,
              actorId: owner.id,
              action: "ai",
            },
            db,
          );
          await customerMessage(
            {
              projectId: project.id,
              customerId: b.customerId,
              conversationId: otherC.id,
              clientMessageId: randomUUID(),
              content: "More help",
            },
            db,
          );
          await processAIConversation(
            db,
            {
              async reply() {
                throw new Error("Must never call provider over allowance");
              },
            },
            project.id,
          );
          assert.match(
            (
              await db.supportConversation.findUniqueOrThrow({
                where: { id: otherC.id },
              })
            ).aiError!,
            /allowance/,
          );
        },
      );
    } finally {
      await db.notificationJob.deleteMany({
        where: { payload: { path: ["project", "id"], equals: project.id } },
      });
      await db.user.delete({ where: { id: owner.id } });
      await db.user.delete({ where: { id: member.id } });
      await db.$disconnect();
    }
  },
);
