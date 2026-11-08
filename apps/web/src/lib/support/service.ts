import { assertEscalationAllowed, supportInteraction } from "./interactions";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../db";
import { getProjectAccess } from "../project-auth";
import { assertProjectAssignee } from "../task-assignment";
import { collaborationTransaction } from "../project-collaboration";
import { queueIntegration } from "../notification-queue";
import { getPlan } from "../plans";
import { hashSupportToken, newSupportToken, verifyIdentity } from "./identity";
import {
  PRESENCE_TTL_MS,
  requireSupportPlan,
  SUPPORT_SESSION_MS,
  SupportError,
  supportLimits,
  usageMonth,
} from "./policy";

export async function supportProject(
  projectId: string,
  client: Pick<Prisma.TransactionClient, "project"> = db,
) {
  const p = await client.project.findUnique({
    where: { id: projectId },
    include: { owner: { select: { plan: true } }, supportConfig: true },
  });
  if (!p) throw new SupportError("Project not found.", 404);
  requireSupportPlan(p.owner.plan);
  return p;
}
export async function supportTeamAccess(
  projectId: string,
  actorId: string,
  manage = false,
  client: Pick<Prisma.TransactionClient, "project"> = db,
) {
  const access = await getProjectAccess(projectId, actorId, client);
  if (!access || (manage && !access.canManage))
    throw new SupportError("Project not found.", 404);
  await supportProject(projectId, client);
  return access;
}
export async function availableAgents(
  projectId: string,
  client: Pick<Prisma.TransactionClient, "supportPresence"> = db,
) {
  return client.supportPresence.findMany({
    where: {
      projectId,
      available: true,
      lastSeenAt: { gt: new Date(Date.now() - PRESENCE_TTL_MS) },
      user: {
        OR: [
          { projects: { some: { id: projectId } } },
          { memberships: { some: { projectId } } },
        ],
      },
    },
    select: { userId: true, user: { select: { name: true } } },
    take: 20,
  });
}
export async function createSupportSession(
  projectId: string,
  identityToken?: string,
  client: PrismaClient = db,
) {
  const project = await supportProject(projectId, client);
  if (!project.supportConfig?.enabled)
    throw new SupportError("Support is not enabled.", 404);
  const identity = identityToken
    ? verifyIdentity(identityToken, projectId)
    : null;
  const token = newSupportToken();
  const result = await client.$transaction(async (tx) => {
    const customer = identity
      ? await tx.supportCustomer.upsert({
          where: {
            projectId_externalId: { projectId, externalId: identity.sub },
          },
          create: {
            projectId,
            externalId: identity.sub,
            name: identity.name ?? null,
            email: identity.email ?? null,
            verified: true,
          },
          update: {
            name: identity.name ?? null,
            email: identity.email ?? null,
            verified: true,
          },
        })
      : await tx.supportCustomer.create({ data: { projectId } });
    await tx.supportSession.create({
      data: {
        projectId,
        customerId: customer.id,
        tokenHash: hashSupportToken(token),
        expiresAt: new Date(Date.now() + SUPPORT_SESSION_MS),
      },
    });
    return customer;
  });
  return {
    token,
    customer: {
      id: result.id,
      name: result.name,
      email: result.email,
      verified: result.verified,
    },
  };
}
export async function authenticateSupportSession(
  projectId: string,
  token: string,
  client: PrismaClient = db,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new SupportError("Chat session expired. Start a new session.", 401);
  const session = await client.supportSession.findUnique({
    where: { tokenHash: hashSupportToken(token) },
    include: { customer: true },
  });
  if (
    !session ||
    session.projectId !== projectId ||
    session.expiresAt.getTime() <= Date.now()
  )
    throw new SupportError("Chat session expired. Start a new session.", 401);
  return session;
}
export async function startConversation(
  projectId: string,
  customerId: string,
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    const project = await supportProject(projectId, tx);
    const config = project.supportConfig;
    if (!config?.enabled)
      throw new SupportError("Support is not enabled.", 404);
    if (
      !(await tx.supportCustomer.count({
        where: { id: customerId, projectId },
      }))
    )
      throw new SupportError("Customer not found.", 404);
    const existing = await tx.supportConversation.findFirst({
      where: { projectId, customerId, state: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing;
    return tx.supportConversation.create({
      data: {
        projectId,
        customerId,
        humanRequested: false,
        state: config.mode === "HUMAN_ONLY" ? "WAITING" : "AI",
        messages: {
          create: {
            clientMessageId: "welcome",
            role: "SYSTEM",
            authorName: `${config.businessName} Team`,
            content: config.welcomeMessage,
          },
        },
      },
    });
  }, client);
}
export async function customerMessage(
  input: {
    projectId: string;
    customerId: string;
    conversationId: string;
    clientMessageId: string;
    content: string;
  },
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    const c = await tx.supportConversation.findFirst({
      where: {
        id: input.conversationId,
        projectId: input.projectId,
        customerId: input.customerId,
      },
      include: { customer: true },
    });
    if (!c) throw new SupportError("Conversation not found.", 404);
    const existing = await tx.supportMessage.findUnique({
      where: {
        conversationId_clientMessageId: {
          conversationId: c.id,
          clientMessageId: input.clientMessageId,
        },
      },
    });
    if (existing) {
      if (existing.role !== "CUSTOMER" || existing.content !== input.content)
        throw new SupportError("Message identifier is already in use.", 409);
      return existing;
    }
    if (c.state === "RESOLVED")
      throw new SupportError(
        "This conversation is resolved. Start a new conversation.",
        409,
      );
    if (
      (await tx.supportMessage.count({ where: { conversationId: c.id } })) >=
      500
    )
      throw new SupportError(
        "This conversation is full. Ask the team to resolve it and start a new one.",
        409,
      );
    const message = await tx.supportMessage.create({
      data: {
        conversationId: c.id,
        clientMessageId: input.clientMessageId,
        role: "CUSTOMER",
        authorName: c.customer.name || "Visitor",
        content: input.content,
      },
    });
    const email = extractCustomerEmail(input.content);
    if (email && !c.customer.verified)
      await tx.supportCustomer.update({
        where: { id: c.customerId },
        data: { email },
      });
    await tx.supportConversation.update({
      where: { id: c.id },
      data: {
        revision: { increment: 1 },
        aiPending: c.state === "AI",
        aiError: null,
        aiAttempts: 0,
      },
    });
    return message;
  }, client);
}
export async function createSupportTicket(
  projectId: string,
  conversationId: string,
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    const c = await tx.supportConversation.findFirst({
      where: { id: conversationId, projectId },
      include: {
        customer: true,
        messages: {
          where: { role: { in: ["CUSTOMER", "AGENT", "ASSISTANT"] } },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
        project: {
          include: { owner: { select: { plan: true } }, supportConfig: true },
        },
      },
    });
    if (!c) throw new SupportError("Conversation not found.", 404);
    requireSupportPlan(c.project.owner.plan);
    if (c.ticketId) {
      if (c.ticketPending)
        await tx.supportConversation.update({
          where: { id: c.id },
          data: { ticketPending: false },
        });
      return {
        ticketId: c.ticketId,
        reference: c.ticketReference,
        supportEmail: c.project.supportConfig?.supportEmail || null,
      };
    }
    const reference =
      c.ticketReference ||
      `UP-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const contactEmail = c.project.supportConfig?.supportEmail || null;
    const customerMessages = c.messages.filter((m) => m.role === "CUSTOMER");
    if (!customerMessages.length)
      throw new SupportError("Describe the issue before creating a ticket.");
    if (
      (await tx.feedback.count({ where: { projectId } })) >=
      getPlan(c.project.owner.plan).feedbackLimit
    )
      throw new SupportError(
        "This project's ticket limit has been reached.",
        402,
      );
    const latest = c.messages.find((m) => m.role === "ASSISTANT");
    const meta = latest?.metadata as {
      ticketTitle?: string;
      ticketType?: string;
    } | null;
    const title =
      meta?.ticketTitle?.trim().slice(0, 160) ||
      customerMessages.at(-1)!.content.slice(0, 160);
    const type =
      meta?.ticketType === "BUG" || meta?.ticketType === "FEATURE"
        ? meta.ticketType
        : "GENERAL";
    const transcript = [...c.messages]
      .reverse()
      .map((m) => `${m.authorName}: ${m.content}`)
      .join("\n\n")
      .slice(0, 12_000);
    const status = await tx.status.findFirst({
      where: { projectId, isDone: false },
      orderBy: { order: "asc" },
    });
    const label = await tx.label.upsert({
      where: { projectId_name: { projectId, name: "Support" } },
      create: { projectId, name: "Support", color: "#6366f1" },
      update: {},
    });
    const ticket = await tx.feedback.create({
      data: {
        projectId,
        title: `[${reference}] ${title}`,
        content: `Reference: ${reference}\nCustomer: ${c.customer.name || "Visitor"}${c.customer.email ? `\nEmail: ${c.customer.email}` : ""}\n\n${transcript}\n\nSupport conversation: /dashboard/projects/${projectId}?tab=support&conversation=${c.id}`,
        type,
        status: "OPEN",
        statusId: status?.id ?? null,
        internal: true,
        assigneeId: c.assignedToId,
        labels: { connect: { id: label.id } },
        metadata: { supportConversationId: c.id, ticketReference: reference },
      },
    });
    await tx.supportConversation.update({
      where: { id: c.id },
      data: {
        ticketId: ticket.id,
        ticketReference: reference,
        ticketPending: false,
        ticketError: null,
      },
    });
    await tx.supportMessage.upsert({
      where: {
        conversationId_clientMessageId: {
          conversationId: c.id,
          clientMessageId: "ticket-created",
        },
      },
      create: {
        conversationId: c.id,
        clientMessageId: "ticket-created",
        role: "SYSTEM",
        authorName: `${c.project.supportConfig?.businessName || c.project.name} Team`,
        content: `Your ticket ${reference} has been created.${contactEmail ? ` You can email ${contactEmail} and quote this reference.` : ""} The team can follow up here. You can optionally add your email for the team; AI can keep helping in this chat.`,
        metadata: {
          ticketId: ticket.id,
          ticketReference: reference,
          supportEmail: contactEmail,
        },
      },
      update: {},
    });
    await queueIntegration(
      {
        event: "NEW_FEEDBACK",
        project: { id: projectId, name: c.project.name },
        feedback: {
          id: ticket.id,
          title,
          content: ticket.content,
          type,
          internal: true,
        },
      },
      tx,
    );
    return { ticketId: ticket.id, reference, supportEmail: contactEmail };
  }, client);
}
export function extractCustomerEmail(content: string): string | null {
  const emails = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  if (emails.length !== 1) return null;
  const email = emails[0]!.toLowerCase();
  const rest = content.replace(emails[0]!, "").trim();
  return !rest ||
    /(?:my (?:contact )?email|email me|reach me|contact me|you can (?:email|reach|contact) me)/i.test(
      content,
    )
    ? email
    : null;
}
export async function requestHuman(
  projectId: string,
  conversationId: string,
  customerId: string,
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    await assertEscalationAllowed(projectId, customerId, conversationId, tx);
    const c = await tx.supportConversation.findFirst({
      where: { id: conversationId, projectId, customerId },
      include: {
        project: { include: { supportConfig: true } },
        messages: {
          where: { role: "CUSTOMER" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!c) throw new SupportError("Conversation not found.", 404);
    if (c.humanRequested) {
      if (!c.ticketId && c.messages.length)
        await tx.supportConversation.update({
          where: { id: c.id },
          data: { ticketPending: true },
        });
      return;
    }
    if (c.state === "HUMAN") return;
    const online = await availableAgents(projectId, tx);
    const useAI =
      !online.length && c.project.supportConfig?.mode !== "HUMAN_ONLY";
    await tx.supportConversation.update({
      where: { id: c.id },
      data: {
        state: useAI ? "AI" : "WAITING",
        humanRequested: true,
        revision: { increment: 1 },
        aiPending: false,
        ticketPending: c.messages.length > 0 && !c.ticketId,
        aiLock: null,
        aiLockedAt: null,
      },
    });
    await tx.supportMessage.create({
      data: {
        conversationId: c.id,
        clientMessageId: `handoff:${randomUUID()}`,
        role: "SYSTEM",
        authorName: `${c.project.supportConfig?.businessName || c.project.name} Team`,
        content: online.length
          ? "You've been added to the team's queue. A teammate will join when they can."
          : useAI
            ? "The team is away right now. Your contact details are saved for follow-up. AI can keep helping while we prepare your ticket."
            : "The team is away. Your request and contact details are saved for follow-up.",
      },
    });
  }, client);
}
export async function teamConversationAction(
  input: {
    projectId: string;
    conversationId: string;
    actorId: string;
    action: "reply" | "note" | "takeover" | "assign" | "resolve" | "ai";
    content?: string | undefined;
    clientMessageId?: string | undefined;
    assigneeId?: string | null | undefined;
  },
  client: PrismaClient = db,
) {
  return collaborationTransaction(async (tx) => {
    await supportTeamAccess(input.projectId, input.actorId, false, tx);
    const c = await tx.supportConversation.findFirst({
      where: { id: input.conversationId, projectId: input.projectId },
      include: {
        project: {
          select: {
            name: true,
            supportConfig: { select: { businessName: true } },
          },
        },
      },
    });
    if (!c) throw new SupportError("Conversation not found.", 404);
    const author = await tx.user.findUniqueOrThrow({
      where: { id: input.actorId },
      select: { name: true, email: true },
    });
    const name =
      author.name?.trim() ||
      `${c.project.supportConfig?.businessName || c.project.name} Team`;
    if (input.action === "reply" || input.action === "note") {
      if (!input.content?.trim() || !input.clientMessageId)
        throw new SupportError("Enter a message.");
      const duplicate = await tx.supportMessage.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId: c.id,
            clientMessageId: input.clientMessageId,
          },
        },
      });
      if (duplicate) {
        if (
          duplicate.content !== input.content.trim() ||
          duplicate.role !== (input.action === "note" ? "NOTE" : "AGENT")
        )
          throw new SupportError("Message identifier is already in use.", 409);
        return;
      }
      await tx.supportMessage.create({
        data: {
          conversationId: c.id,
          clientMessageId: input.clientMessageId,
          role: input.action === "note" ? "NOTE" : "AGENT",
          authorName: name,
          content: input.content.trim(),
        },
      });
      if (input.action === "note") {
        await tx.supportConversation.update({
          where: { id: c.id },
          data: { updatedAt: new Date() },
        });
        return;
      }
    }
    const data: Prisma.SupportConversationUncheckedUpdateInput = {
      revision: { increment: 1 },
      aiLock: null,
      aiLockedAt: null,
      aiPending: false,
      aiError: null,
    };
    if (["reply", "takeover"].includes(input.action)) {
      data.state = "HUMAN";
      data.assignedToId = input.actorId;
    }
    if (input.action === "assign") {
      await assertProjectAssignee(
        input.projectId,
        input.assigneeId ?? null,
        tx,
      );
      data.assignedToId = input.assigneeId ?? null;
      data.state = input.assigneeId ? "HUMAN" : "WAITING";
    }
    if (input.action === "resolve") data.state = "RESOLVED";
    if (input.action === "ai") {
      const project = await supportProject(input.projectId, tx);
      if (project.supportConfig?.mode === "HUMAN_ONLY")
        throw new SupportError("Enable AI in support settings first.");
      data.humanRequested = false;
      data.state = "AI";
      data.assignedToId = null;
      const last = await tx.supportMessage.findFirst({
        where: {
          conversationId: c.id,
          role: { in: ["CUSTOMER", "ASSISTANT", "AGENT"] },
        },
        orderBy: { createdAt: "desc" },
      });
      data.aiPending = last?.role === "CUSTOMER";
    }
    await tx.supportConversation.update({ where: { id: c.id }, data });
    if (c.ticketId && data.assignedToId !== undefined)
      await tx.feedback.updateMany({
        where: { id: c.ticketId, projectId: input.projectId },
        data: {
          assigneeId:
            typeof data.assignedToId === "string" ? data.assignedToId : null,
        },
      });
    if (input.action !== "reply")
      await tx.supportMessage.create({
        data: {
          conversationId: c.id,
          clientMessageId: randomUUID(),
          role: "SYSTEM",
          authorName: name,
          content:
            input.action === "resolve"
              ? "This conversation was resolved."
              : input.action === "ai"
                ? "The AI assistant is available again."
                : input.action === "assign"
                  ? "The conversation was reassigned."
                  : `${name} joined the conversation.`,
        },
      });
  }, client);
}
export async function supportUsage(
  ownerId: string,
  plan: string,
  client: PrismaClient = db,
) {
  const usage = await client.supportUsage.findUnique({
    where: { ownerId_month: { ownerId, month: usageMonth() } },
  });
  return {
    used: usage?.aiReplies ?? 0,
    limit: supportLimits(plan).aiReplies,
    month: usageMonth(),
  };
}

export async function submitSupportContact(
  input: {
    projectId: string;
    customerId: string;
    conversationId: string;
    name: string;
    email: string;
  },
  client: PrismaClient = db,
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (
    !name ||
    name.length > 100 ||
    !z.string().email().max(254).safeParse(email).success
  )
    throw new SupportError("Enter your name and a valid email address.");
  await collaborationTransaction(async (tx) => {
    const context = await supportInteraction(
      input.projectId,
      input.customerId,
      input.conversationId,
      tx,
    );
    if (!context.canEscalate && !context.conversation.humanRequested)
      throw new SupportError(
        "AI needs to understand the issue and try to help first.",
        409,
      );
    const customer = context.conversation.customer;
    if (
      customer.verified &&
      customer.email &&
      customer.email.toLowerCase() !== email
    )
      throw new SupportError("Use your account email for this request.");
    await tx.supportCustomer.update({
      where: { id: input.customerId },
      data: { name, email },
    });
  }, client);
  await requestHuman(
    input.projectId,
    input.conversationId,
    input.customerId,
    client,
  );
}
export async function submitIssueDetails(
  input: {
    projectId: string;
    customerId: string;
    conversationId: string;
    widgetId: string;
    summary: string;
    details?: string | undefined;
    reference?: string | undefined;
    clientMessageId: string;
  },
  client: PrismaClient = db,
) {
  const content = [
    input.summary.trim(),
    input.details?.trim(),
    input.reference?.trim() ? `Reference: ${input.reference.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const existing = await client.supportMessage.findFirst({
    where: {
      conversationId: input.conversationId,
      clientMessageId: input.clientMessageId,
      conversation: {
        projectId: input.projectId,
        customerId: input.customerId,
      },
    },
  });
  if (existing) {
    if (existing.role !== "CUSTOMER" || existing.content !== content)
      throw new SupportError("Message identifier is already in use.", 409);
    return existing;
  }
  const context = await supportInteraction(
    input.projectId,
    input.customerId,
    input.conversationId,
    client,
  );
  if (
    !context.widgets.some(
      (w) => w.id === input.widgetId && w.type === "issue_details",
    ) ||
    !context.activeWidgetMessageId
  )
    throw new SupportError(
      "This form has changed. Use the latest question in the chat.",
      409,
    );
  return customerMessage(
    {
      projectId: input.projectId,
      customerId: input.customerId,
      conversationId: input.conversationId,
      clientMessageId: input.clientMessageId,
      content,
    },
    client,
  );
}
