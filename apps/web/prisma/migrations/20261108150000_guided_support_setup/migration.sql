ALTER TABLE "SupportConfig"
ADD COLUMN "supportEmail" TEXT,
ADD COLUMN "businessSummary" TEXT,
ADD COLUMN "agentInstructions" TEXT,
ADD COLUMN "businessProfile" JSONB,
ADD COLUMN "learningState" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN "learningAnalysis" JSONB,
ADD COLUMN "learningGeneration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "learningLock" TEXT,
ADD COLUMN "learningLockedAt" TIMESTAMP(3),
ADD COLUMN "learningError" TEXT;
ALTER TABLE "SupportConversation"
ADD COLUMN "ticketReference" TEXT,
ADD COLUMN "ticketPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ticketError" TEXT;
UPDATE "SupportConversation" SET "ticketReference" = 'UP-' || upper(substr(md5("id"), 1, 12)) WHERE "ticketId" IS NOT NULL;
CREATE UNIQUE INDEX "SupportConversation_ticketReference_key" ON "SupportConversation"("ticketReference");
ALTER TABLE "SupportUsage" ADD COLUMN "learningCalls" INTEGER NOT NULL DEFAULT 0;
