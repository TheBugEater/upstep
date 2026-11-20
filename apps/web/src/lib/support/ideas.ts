import { Prisma, type PrismaClient } from "@prisma/client";
import type { IdeaPrompt } from "@upstep/types";
import { db } from "../db";
import { getPlan } from "../plans";
import { containsProfanity } from "../profanity";
import { queueNewFeedbackEmails } from "../email-notifications";
import {
  kickNotificationProcessor,
  queueIntegration,
} from "../notification-queue";
import { SupportError } from "./policy";

// Feature requests raised in support chat go to the public ideas board, where
// votes rank them, instead of becoming private tickets nobody else can +1.

type Candidate = {
  id: string;
  title: string | null;
  content: string;
  upvotes: number;
};

const STOP_WORDS = new Set(
  (
    "the and for you your our are was were can could would should will with " +
    "that this these those from into have has had not but all any its it's " +
    "add adding able ability allow allowing option options support supports " +
    "feature features please want wish like need make makes more some when " +
    "there their them they what which while also just get way use using new " +
    "app would've i'd it'd"
  ).split(" "),
);

/** Distinctive words of a request, lightly normalised for matching. */
export function ideaKeywords(text: string) {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
  return [...new Set(words)].slice(0, 8);
}

/** Ranks public ideas against a request: title hits count double, then votes break ties. */
export function rankIdeas(query: string, items: Candidate[], limit = 3) {
  const keywords = ideaKeywords(query);
  if (!keywords.length) return [];
  return items
    .map((item) => {
      const title = (item.title || "").toLowerCase();
      const content = item.content.toLowerCase();
      let score = 0;
      let hits = 0;
      for (const k of keywords) {
        if (title.includes(k)) {
          score += 2;
          hits++;
        } else if (content.includes(k)) {
          score += 1;
          hits++;
        }
      }
      return { item, score, hits };
    })
    .filter((r) => r.score >= 2 && r.hits / keywords.length >= 0.5)
    .sort((a, b) => b.score - a.score || b.item.upvotes - a.item.upvotes)
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      title: ideaTitle(item),
      upvotes: item.upvotes,
    }));
}

function ideaTitle(item: { title: string | null; content: string }) {
  const text = (item.title || item.content).replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** The same visibility rules as the widget's Ideas list. */
const publicIdea = {
  internal: false,
  supportConversation: null,
  status: { notIn: ["PENDING", "CLOSED", "DONE"] },
  NOT: { boardStatus: { isDone: true } },
} satisfies Prisma.FeedbackWhereInput;

export async function matchingIdeas(
  projectId: string,
  query: string,
  client: Pick<PrismaClient, "feedback"> = db,
) {
  const keywords = ideaKeywords(query);
  if (!keywords.length) return [];
  const candidates = await client.feedback.findMany({
    where: {
      projectId,
      ...publicIdea,
      OR: keywords.flatMap((k) => [
        { title: { contains: k, mode: "insensitive" as const } },
        { content: { contains: k, mode: "insensitive" as const } },
      ]),
    },
    select: { id: true, title: true, content: true, upvotes: true },
    orderBy: { upvotes: "desc" },
    take: 100,
  });
  return rankIdeas(query, candidates);
}

export function buildIdeaPrompt(
  turnId: string,
  suggestedTitle: string,
  matches: IdeaPrompt["matches"],
): IdeaPrompt {
  return {
    id: `idea:${turnId}`,
    title: matches.length
      ? "Others asked for this too"
      : "Add this to the ideas board",
    suggestedTitle: suggestedTitle.trim().slice(0, 160),
    matches,
  };
}

type IdeaChoice =
  | { kind: "vote"; feedbackId: string }
  | { kind: "suggest"; title: string; details?: string | undefined };

/**
 * Applies the customer's answer to an idea prompt: a vote on one of the
 * matches it offered, or a new public idea. Answering twice is a no-op.
 */
export async function answerIdeaPrompt(
  input: {
    projectId: string;
    customerId: string;
    conversationId: string;
    promptId: string;
    choice: IdeaChoice;
  },
  client: PrismaClient = db,
) {
  // The confirmation message's unique (conversation, clientMessageId) key makes
  // this idempotent: a concurrent second answer fails on it and rolls back its
  // vote or idea, then returns the first answer's confirmation.
  const run = () =>
    client.$transaction(async (tx) => {
      const conversation = await tx.supportConversation.findFirst({
        where: {
          id: input.conversationId,
          projectId: input.projectId,
          customerId: input.customerId,
        },
        include: {
          customer: true,
          project: { include: { owner: { select: { plan: true } } } },
        },
      });
      if (!conversation) throw new SupportError("Conversation not found.", 404);
      if (conversation.state === "RESOLVED")
        throw new SupportError(
          "This conversation is resolved. Start a new conversation.",
          409,
        );
      const answered = await tx.supportMessage.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId: conversation.id,
            clientMessageId: input.promptId,
          },
        },
      });
      if (answered) return { message: answered, notify: false };
      const source = await tx.supportMessage.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId: conversation.id,
            clientMessageId: `ai:${input.promptId.replace(/^idea:/, "")}`,
          },
        },
      });
      const prompt = (source?.metadata as { ideaPrompt?: IdeaPrompt } | null)
        ?.ideaPrompt;
      if (!prompt || prompt.id !== input.promptId)
        throw new SupportError("This suggestion is no longer available.", 409);

      const voter =
        conversation.customer.verified && conversation.customer.externalId
          ? { endUserId: conversation.customer.externalId }
          : { anonymousId: `support:${conversation.customer.id}` };
      const project = conversation.project;
      let content: string;
      let feedbackId: string;

      if (input.choice.kind === "vote") {
        const { feedbackId: id } = input.choice;
        if (!prompt.matches.some((m) => m.id === id))
          throw new SupportError("Choose one of the suggested ideas.", 400);
        const idea = await tx.feedback.findFirst({
          where: { id, projectId: project.id, ...publicIdea },
          select: { id: true, title: true, content: true, type: true },
        });
        if (!idea)
          throw new SupportError("That idea is no longer open for votes.", 409);
        const existing = await tx.vote.findUnique({
          where:
            "endUserId" in voter
              ? {
                  feedbackId_endUserId: {
                    feedbackId: id,
                    endUserId: voter.endUserId,
                  },
                }
              : {
                  feedbackId_anonymousId: {
                    feedbackId: id,
                    anonymousId: voter.anonymousId,
                  },
                },
        });
        if (existing?.value === "DOWN") {
          await tx.vote.update({
            where: { id: existing.id },
            data: { value: "UP" },
          });
          await tx.feedback.update({
            where: { id },
            data: { upvotes: { increment: 1 }, downvotes: { decrement: 1 } },
          });
        } else if (!existing) {
          await tx.vote.create({
            data: { feedbackId: id, value: "UP", ...voter },
          });
          const updated = await tx.feedback.update({
            where: { id },
            data: { upvotes: { increment: 1 } },
            select: {
              id: true,
              title: true,
              content: true,
              type: true,
              upvotes: true,
              downvotes: true,
            },
          });
          await queueIntegration(
            {
              event: "NEW_VOTE",
              project: { id: project.id, name: project.name },
              feedback: updated,
              vote: { value: "UP" },
            },
            tx,
          );
        }
        feedbackId = id;
        content = `Added your vote to “${ideaTitle(idea)}”. You can follow it in Ideas.`;
      } else {
        const title = input.choice.title.replace(/\s+/g, " ").trim();
        const details = input.choice.details?.trim() || "";
        if (title.length < 3)
          throw new SupportError("Give the idea a short title.", 400);
        const plan = getPlan(project.owner.plan);
        if (
          Number.isFinite(plan.feedbackLimit) &&
          (await tx.feedback.count({ where: { projectId: project.id } })) >=
            plan.feedbackLimit
        )
          throw new SupportError(
            "The ideas board is full right now. The team has your message.",
            402,
          );
        const status = project.moderationEnabled ? "PENDING" : "OPEN";
        const body = details || title;
        const flagged = containsProfanity(`${title} ${details}`);
        const defaultStatus = await tx.status.findFirst({
          where: { projectId: project.id, isDone: false },
          orderBy: { order: "asc" },
          select: { id: true },
        });
        const created = await tx.feedback.create({
          data: {
            projectId: project.id,
            title,
            content: body,
            type: "FEATURE",
            status,
            flagged,
            upvotes: 1,
            ...(defaultStatus ? { statusId: defaultStatus.id } : {}),
            ...voter,
            // Only the customer's own words are published, never the transcript.
            metadata: {
              source: "support",
              supportConversationId: conversation.id,
            },
            votes: { create: { value: "UP", ...voter } },
          },
        });
        const payload = {
          title: created.title,
          content: created.content,
          type: created.type,
          status: created.status,
          flagged: created.flagged,
        };
        await queueIntegration(
          {
            event: "NEW_FEEDBACK",
            project: { id: project.id, name: project.name },
            feedback: { id: created.id, ...payload },
          },
          tx,
        );
        await queueNewFeedbackEmails(project.id, payload, tx);
        feedbackId = created.id;
        content =
          status === "PENDING"
            ? `Thanks. “${title}” is with the team for review and will appear in Ideas once it’s approved.`
            : `“${title}” is now on the ideas board with your vote. Others can vote on it too.`;
      }

      const message = await tx.supportMessage.create({
        data: {
          conversationId: conversation.id,
          clientMessageId: input.promptId,
          role: "SYSTEM",
          authorName: "Ideas",
          content,
          metadata: { ideaPromptId: input.promptId, feedbackId },
        },
      });
      await tx.supportConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });
      return { message, notify: true };
    });
  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run();
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    const message = await client.supportMessage.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId: input.conversationId,
          clientMessageId: input.promptId,
        },
      },
    });
    if (!message) throw error;
    return message;
  }
  if (result.notify) kickNotificationProcessor();
  return result.message;
}
