import { nanoid } from "nanoid";
import { db } from "@/lib/db";

/** Creates a project pre-seeded with the default Open/In Progress/Done board. */
export async function createProjectWithDefaults(name: string, ownerId: string) {
  const project = await db.project.create({
    data: {
      name,
      apiKey: `upstep_${nanoid(32)}`,
      ownerId,
      statuses: {
        create: [
          { name: "Open", color: "#f59e0b", order: 0 },
          { name: "In Progress", color: "#3b82f6", order: 1 },
          { name: "Done", color: "#22c55e", order: 2, isDone: true },
        ],
      },
    },
    include: { statuses: { orderBy: { order: "asc" } } },
  });

  await db.board.create({
    data: {
      projectId: project.id,
      name: "Main board",
      isDefault: true,
      columns: {
        create: project.statuses.map((s, order) => ({ statusId: s.id, order })),
      },
    },
  });

  return project;
}
