import type { Prisma } from "@prisma/client";
import type { IntegrationPayload } from "./integrations";

/** Capture presentation context when queued, so retries keep the event's state. */
export async function withIntegrationContext<T extends IntegrationPayload>(
  payload: T,
  client: Pick<Prisma.TransactionClient, "feedback">,
): Promise<T> {
  const context = await client.feedback.findFirst({
    where: { id: payload.feedback.id, projectId: payload.project.id },
    select: {
      status: true, internal: true,
      boardStatus: { select: { name: true, color: true, isDone: true } },
      labels: { select: { name: true, color: true }, orderBy: { name: "asc" } },
      assignee: { select: { name: true } },
    },
  });
  if (!context) return payload;
  return {
    ...payload,
    feedback: { ...context, ...payload.feedback },
  };
}
