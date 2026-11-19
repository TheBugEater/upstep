import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";

export const supportProfileSchema = z.strictObject({
  supportDisplayName: z.string().trim().max(80).regex(/^[^\u0000-\u001f\u007f]*$/, "Use a name on a single line."),
});

export function supportAuthorName(user: { name: string | null; supportDisplayName: string | null }, fallback = "Teammate") {
  return user.supportDisplayName?.trim() || user.name?.trim() || fallback;
}

export async function getSupportProfile(userId: string, client: PrismaClient = db) {
  const user = await client.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, supportDisplayName: true } });
  return { supportDisplayName: user.supportDisplayName || "", fallbackName: user.name?.trim() || "Teammate" };
}

export async function saveSupportProfile(userId: string, input: z.infer<typeof supportProfileSchema>, client: PrismaClient = db) {
  const parsed = supportProfileSchema.parse(input);
  await client.user.update({ where: { id: userId }, data: { supportDisplayName: parsed.supportDisplayName || null } });
  return getSupportProfile(userId, client);
}
