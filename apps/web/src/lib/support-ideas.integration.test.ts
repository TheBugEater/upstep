import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { IdeaPrompt } from "@upstep/types";
import {
  createSupportSession,
  authenticateSupportSession,
  startConversation,
  customerMessage,
} from "./support/service";
import { processAIConversation } from "./support/worker";
import { answerIdeaPrompt } from "./support/ideas";
import type { SupportAIProvider } from "./support/ai";

const url = process.env.UPSTEP_INVITATION_TEST_DATABASE_URL;

test(
  "support feature requests: matching public ideas, votes and new ideas",
  { skip: !url },
  async (t) => {
    const db = new PrismaClient({ datasourceUrl: url! });
    const suffix = randomUUID();
    const owner = await db.user.create({
      data: { email: `ideas-${suffix}@example.test`, plan: "PRO" },
    });
    const project = await db.project.create({
      data: {
        name: "Acme",
        slug: `ideas-${suffix}`,
        ownerId: owner.id,
        moderationEnabled: false,
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
    const idea = (title: string, extra = {}) =>
      db.feedback.create({
        data: {
          projectId: project.id,
          title,
          content: title,
          type: "FEATURE",
          upvotes: 4,
          ...extra,
        },
      });
    const darkMode = await idea("Dark mode for the dashboard");
    const privateDark = await idea("Dark mode dashboard (internal)", {
      internal: true,
    });
    const pendingDark = await idea("Dark mode dashboard pending", {
      status: "PENDING",
    });
    await idea("Export invoices to CSV");

    let title = "Dark mode for the dashboard";
    const provider: SupportAIProvider = {
      async reply() {
        return {
          inScope: true,
          resolution: "answer",
          featureRequest: true,
          reply: "Dark mode isn't available yet. You can vote for it below.",
          sources: [],
          offerTicket: false,
          handoff: false,
          ticketTitle: title,
          ticketType: "FEATURE",
        };
      },
    };
    const turn = async (customerId: string, content: string) => {
      const c = await startConversation(project.id, customerId, db, {
        fresh: true,
      });
      await customerMessage(
        {
          projectId: project.id,
          customerId,
          conversationId: c.id,
          clientMessageId: randomUUID(),
          content,
        },
        db,
      );
      assert.equal(await processAIConversation(db, provider, project.id), true);
      const reply = await db.supportMessage.findFirstOrThrow({
        where: { conversationId: c.id, role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
      });
      const prompt = (reply.metadata as { ideaPrompt?: IdeaPrompt })
        .ideaPrompt!;
      return { conversation: c, prompt };
    };

    try {
      const session = await createSupportSession(project.id, undefined, db);
      const customer = await authenticateSupportSession(
        project.id,
        session.token,
        db,
      );

      await t.test(
        "the AI reply offers only public, open matching ideas",
        async () => {
          const { conversation, prompt } = await turn(
            customer.customerId,
            "Could you add a dark mode? My email is me@example.com",
          );
          assert.deepEqual(
            prompt.matches.map((m) => m.id),
            [darkMode.id],
          );
          assert.ok(
            !prompt.matches.some(
              (m) => m.id === privateDark.id || m.id === pendingDark.id,
            ),
          );
          const state = await db.supportConversation.findUniqueOrThrow({
            where: { id: conversation.id },
          });
          assert.equal(state.state, "AI", "feature requests don't escalate");
          assert.equal(state.ticketId, null);

          await assert.rejects(
            answerIdeaPrompt(
              {
                projectId: project.id,
                customerId: customer.customerId,
                conversationId: conversation.id,
                promptId: prompt.id,
                choice: { kind: "vote", feedbackId: privateDark.id },
              },
              db,
            ),
            /suggested ideas/,
          );
          const vote = () =>
            answerIdeaPrompt(
              {
                projectId: project.id,
                customerId: customer.customerId,
                conversationId: conversation.id,
                promptId: prompt.id,
                choice: { kind: "vote", feedbackId: darkMode.id },
              },
              db,
            );
          const confirmation = await vote();
          assert.equal(confirmation.role, "SYSTEM");
          assert.match(confirmation.content, /Added your vote/);
          await vote();
          const updated = await db.feedback.findUniqueOrThrow({
            where: { id: darkMode.id },
            include: { votes: true },
          });
          assert.equal(updated.upvotes, 5, "answering twice votes once");
          assert.equal(
            updated.votes[0]!.anonymousId,
            `support:${customer.customerId}`,
          );
        },
      );

      await t.test(
        "a new idea is public, carries only the customer's words and their vote",
        async () => {
          title = "Calendar sync with Outlook";
          const { conversation, prompt } = await turn(
            customer.customerId,
            "We need Outlook calendar sync, order 1234",
          );
          assert.equal(prompt.matches.length, 0);
          assert.equal(prompt.suggestedTitle, title);
          await answerIdeaPrompt(
            {
              projectId: project.id,
              customerId: customer.customerId,
              conversationId: conversation.id,
              promptId: prompt.id,
              choice: {
                kind: "suggest",
                title: "Outlook calendar sync",
                details: "Our team plans everything in Outlook.",
              },
            },
            db,
          );
          const created = await db.feedback.findFirstOrThrow({
            where: { projectId: project.id, title: "Outlook calendar sync" },
            include: { votes: true },
          });
          assert.equal(created.internal, false);
          assert.equal(created.status, "OPEN");
          assert.equal(created.type, "FEATURE");
          assert.equal(created.upvotes, 1);
          assert.equal(created.votes.length, 1);
          assert.equal(
            created.content,
            "Our team plans everything in Outlook.",
          );
          assert.doesNotMatch(created.content, /1234/);
        },
      );

      await t.test("moderated projects hold new ideas for review", async () => {
        await db.project.update({
          where: { id: project.id },
          data: { moderationEnabled: true },
        });
        title = "Slack notifications";
        const { conversation, prompt } = await turn(
          customer.customerId,
          "Can I get alerts in Slack?",
        );
        // A double tap sends two answers at once: only one idea is created.
        const answer = () =>
          answerIdeaPrompt(
            {
              projectId: project.id,
              customerId: customer.customerId,
              conversationId: conversation.id,
              promptId: prompt.id,
              choice: { kind: "suggest", title: "Slack notifications" },
            },
            db,
          );
        const [confirmation, again] = await Promise.all([answer(), answer()]);
        assert.equal(confirmation.id, again.id);
        assert.match(confirmation.content, /review/);
        const created = await db.feedback.findFirstOrThrow({
          where: { projectId: project.id, title: "Slack notifications" },
        });
        assert.equal(
          await db.feedback.count({
            where: { projectId: project.id, title: "Slack notifications" },
          }),
          1,
        );
        assert.equal(created.status, "PENDING");
      });
    } finally {
      await db.project.delete({ where: { id: project.id } });
      await db.user.delete({ where: { id: owner.id } });
      await db.$disconnect();
    }
  },
);
