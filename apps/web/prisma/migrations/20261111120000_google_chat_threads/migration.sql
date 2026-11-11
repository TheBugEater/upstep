-- CreateTable
CREATE TABLE "GoogleChatThread" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "threadName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleChatThread_feedbackId_idx" ON "GoogleChatThread"("feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleChatThread_integrationId_feedbackId_key" ON "GoogleChatThread"("integrationId", "feedbackId");

-- AddForeignKey
ALTER TABLE "GoogleChatThread" ADD CONSTRAINT "GoogleChatThread_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleChatThread" ADD CONSTRAINT "GoogleChatThread_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

