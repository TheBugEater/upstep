-- CreateTable Status
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateTable Board
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable BoardColumn
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- AlterTable Feedback — add statusId
ALTER TABLE "Feedback" ADD COLUMN "statusId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Status_projectId_name_key" ON "Status"("projectId", "name");
CREATE INDEX "Status_projectId_order_idx" ON "Status"("projectId", "order");

-- AddForeignKey
ALTER TABLE "Status" ADD CONSTRAINT "Status_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Board" ADD CONSTRAINT "Board_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Seed defaults for every existing project ─────────────────────────────────
-- For each project: create 3 default statuses, 1 default board with 3 columns,
-- then backfill Feedback.statusId from the existing FeedbackStatus enum.

DO $$
DECLARE
  proj      RECORD;
  s_open    TEXT;
  s_prog    TEXT;
  s_done    TEXT;
  b_id      TEXT;
BEGIN
  FOR proj IN SELECT id FROM "Project" LOOP
    s_open := gen_random_uuid()::text;
    s_prog := gen_random_uuid()::text;
    s_done := gen_random_uuid()::text;
    b_id   := gen_random_uuid()::text;

    INSERT INTO "Status" ("id","projectId","name","color","order","isDone")
    VALUES
      (s_open, proj.id, 'Open',        '#f59e0b', 0, false),
      (s_prog, proj.id, 'In Progress', '#3b82f6', 1, false),
      (s_done, proj.id, 'Done',        '#22c55e', 2, true);

    INSERT INTO "Board" ("id","projectId","name","isDefault")
    VALUES (b_id, proj.id, 'Main Board', true);

    INSERT INTO "BoardColumn" ("id","boardId","statusId","order")
    VALUES
      (gen_random_uuid()::text, b_id, s_open, 0),
      (gen_random_uuid()::text, b_id, s_prog, 1),
      (gen_random_uuid()::text, b_id, s_done, 2);

    -- Backfill statusId from enum
    UPDATE "Feedback" SET "statusId" = s_open WHERE "projectId" = proj.id AND "status" = 'OPEN';
    UPDATE "Feedback" SET "statusId" = s_prog WHERE "projectId" = proj.id AND "status" = 'IN_PROGRESS';
    UPDATE "Feedback" SET "statusId" = s_done WHERE "projectId" = proj.id AND "status" = 'DONE';
  END LOOP;
END;
$$;
