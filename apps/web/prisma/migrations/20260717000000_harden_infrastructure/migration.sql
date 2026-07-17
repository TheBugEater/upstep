-- Add query indexes used by the dashboard, public SDK and membership checks.
CREATE INDEX "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");
CREATE INDEX "Feedback_projectId_createdAt_idx" ON "Feedback"("projectId", "createdAt");
CREATE INDEX "Feedback_projectId_status_createdAt_idx" ON "Feedback"("projectId", "status", "createdAt");
CREATE INDEX "Feedback_projectId_statusId_idx" ON "Feedback"("projectId", "statusId");
CREATE INDEX "Feedback_projectId_upvotes_idx" ON "Feedback"("projectId", "upvotes");
CREATE INDEX "Comment_feedbackId_createdAt_idx" ON "Comment"("feedbackId", "createdAt");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "Integration_projectId_idx" ON "Integration"("projectId");
CREATE INDEX "Board_projectId_createdAt_idx" ON "Board"("projectId", "createdAt");
CREATE INDEX "BoardColumn_boardId_order_idx" ON "BoardColumn"("boardId", "order");

CREATE TYPE "NotificationJobType" AS ENUM ('INTEGRATION', 'EMAIL');
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "type" "NotificationJobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationJob_status_availableAt_idx" ON "NotificationJob"("status", "availableAt");
CREATE INDEX "NotificationJob_createdAt_idx" ON "NotificationJob"("createdAt");

CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
