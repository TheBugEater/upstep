import type { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { SupportError } from "../support/policy";
import { saveSupportProfile, supportProfileSchema } from "../support/profile";
import { mobileRequest } from "./auth";

export async function saveMobileSupportProfile(req: Pick<Request, "headers">, input: unknown, client: PrismaClient = db) {
  const { userId } = await mobileRequest(req, client);
  const parsed = supportProfileSchema.safeParse(input);
  if (!parsed.success) throw new SupportError("Use a support name of up to 80 characters on a single line.");
  return saveSupportProfile(userId, parsed.data, client);
}
