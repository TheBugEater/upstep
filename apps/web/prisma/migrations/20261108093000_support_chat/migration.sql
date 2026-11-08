-- CreateTable
CREATE TABLE "SupportConfig" (
    "projectId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "domain" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'AI_FIRST',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi! How can we help you today?',
    "crawlState" TEXT NOT NULL DEFAULT 'QUEUED',
    "crawlQueue" JSONB NOT NULL DEFAULT '[]',
    "crawlVisited" JSONB NOT NULL DEFAULT '[]',
    "crawlGeneration" INTEGER NOT NULL DEFAULT 1,
    "crawlLock" TEXT,
    "crawlLockedAt" TIMESTAMP(3),
    "crawlError" TEXT,
    "crawledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConfig_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "SupportKnowledgePage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportKnowledgePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCustomer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'AI',
    "assignedToId" TEXT,
    "ticketId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "aiPending" BOOLEAN NOT NULL DEFAULT false,
    "aiLock" TEXT,
    "aiLockedAt" TIMESTAMP(3),
    "aiAttempts" INTEGER NOT NULL DEFAULT 0,
    "aiError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientMessageId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPresence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportUsage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "aiReplies" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SupportUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportKnowledgePage_projectId_generation_idx" ON "SupportKnowledgePage"("projectId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "SupportKnowledgePage_projectId_generation_url_key" ON "SupportKnowledgePage"("projectId", "generation", "url");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCustomer_projectId_externalId_key" ON "SupportCustomer"("projectId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportSession_tokenHash_key" ON "SupportSession"("tokenHash");

-- CreateIndex
CREATE INDEX "SupportSession_projectId_customerId_idx" ON "SupportSession"("projectId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportConversation_ticketId_key" ON "SupportConversation"("ticketId");

-- CreateIndex
CREATE INDEX "SupportConversation_projectId_updatedAt_idx" ON "SupportConversation"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportConversation_aiPending_aiLockedAt_idx" ON "SupportConversation"("aiPending", "aiLockedAt");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_conversationId_clientMessageId_key" ON "SupportMessage"("conversationId", "clientMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportPresence_projectId_userId_key" ON "SupportPresence"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportUsage_ownerId_month_key" ON "SupportUsage"("ownerId", "month");

-- AddForeignKey
ALTER TABLE "SupportConfig" ADD CONSTRAINT "SupportConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportKnowledgePage" ADD CONSTRAINT "SupportKnowledgePage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCustomer" ADD CONSTRAINT "SupportCustomer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "SupportCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "SupportCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPresence" ADD CONSTRAINT "SupportPresence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPresence" ADD CONSTRAINT "SupportPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportUsage" ADD CONSTRAINT "SupportUsage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Full-text retrieval stays provider independent; no embedding migration is
-- needed when the project's AI provider changes.
CREATE INDEX "SupportKnowledgePage_search_idx" ON "SupportKnowledgePage"
USING GIN (to_tsvector('simple', "title" || ' ' || "content"));
