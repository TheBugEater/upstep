-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "anonymousId" TEXT;

-- AlterTable
ALTER TABLE "Vote" ADD COLUMN "anonymousId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vote_feedbackId_anonymousId_key" ON "Vote"("feedbackId", "anonymousId");
