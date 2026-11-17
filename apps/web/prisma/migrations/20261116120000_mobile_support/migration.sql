-- AlterEnum
ALTER TYPE "NotificationJobType" ADD VALUE 'PUSH';

-- CreateTable
CREATE TABLE "MobileLoginCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "activeConversationId" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPushPreference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "onCall" BOOLEAN NOT NULL DEFAULT true,
    "quietUntil" TIMESTAMP(3),

    CONSTRAINT "SupportPushPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPushDelivery" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ticketId" TEXT,
    "receiptCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobileLoginCode_codeHash_key" ON "MobileLoginCode"("codeHash");

-- CreateIndex
CREATE INDEX "MobileLoginCode_expiresAt_idx" ON "MobileLoginCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileSession_accessHash_key" ON "MobileSession"("accessHash");

-- CreateIndex
CREATE UNIQUE INDEX "MobileSession_refreshHash_key" ON "MobileSession"("refreshHash");

-- CreateIndex
CREATE INDEX "MobileSession_userId_revokedAt_idx" ON "MobileSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MobileDevice_sessionId_key" ON "MobileDevice"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MobileDevice_pushToken_key" ON "MobileDevice"("pushToken");

-- CreateIndex
CREATE UNIQUE INDEX "SupportPushPreference_projectId_userId_key" ON "SupportPushPreference"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRead_userId_conversationId_key" ON "SupportRead"("userId", "conversationId");

-- CreateIndex
CREATE INDEX "SupportPushDelivery_receiptCheckedAt_createdAt_idx" ON "SupportPushDelivery"("receiptCheckedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportPushDelivery_eventId_deviceId_key" ON "SupportPushDelivery"("eventId", "deviceId");

-- AddForeignKey
ALTER TABLE "MobileLoginCode" ADD CONSTRAINT "MobileLoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileSession" ADD CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileDevice" ADD CONSTRAINT "MobileDevice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPushPreference" ADD CONSTRAINT "SupportPushPreference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPushPreference" ADD CONSTRAINT "SupportPushPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRead" ADD CONSTRAINT "SupportRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRead" ADD CONSTRAINT "SupportRead_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPushDelivery" ADD CONSTRAINT "SupportPushDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
