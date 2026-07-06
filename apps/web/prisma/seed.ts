import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_FEEDBACK = [
  {
    content: "The dark mode toggle doesn't persist after a page refresh.",
    type: "BUG",
    status: "OPEN",
  },
  {
    content: "Would love a CSV export for all feedback.",
    type: "FEATURE",
    status: "IN_PROGRESS",
  },
  {
    content: "General feedback: the onboarding flow is really smooth!",
    type: "GENERAL",
    status: "DONE",
  },
  {
    content: "Button on the settings page is misaligned on mobile.",
    type: "BUG",
    status: "OPEN",
  },
  {
    content: "Add keyboard shortcuts for power users.",
    type: "FEATURE",
    status: "OPEN",
  },
  {
    content: "The loading spinner disappears too quickly.",
    type: "GENERAL",
    status: "IN_PROGRESS",
  },
] as const;

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@upstep.dev" },
    update: {},
    create: { email: "demo@upstep.dev", name: "Demo User" },
  });

  const project = await prisma.project.upsert({
    where: { apiKey: "demo-api-key-upstep" },
    update: {},
    create: {
      name: "Demo App",
      apiKey: "demo-api-key-upstep",
      ownerId: user.id,
    },
  });

  for (const item of SAMPLE_FEEDBACK) {
    await prisma.feedback.create({
      data: {
        projectId: project.id,
        content: item.content,
        type: item.type,
        status: item.status,
        upvotes: Math.floor(Math.random() * 20),
        downvotes: Math.floor(Math.random() * 5),
      },
    });
  }

  console.log("Seed complete. Project API key:", project.apiKey);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
