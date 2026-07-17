-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "slug" TEXT;

-- Backfill existing rows with a slug derived from the project name, disambiguated
-- with a slice of the cuid so uniqueness is guaranteed without a manual pass.
UPDATE "Project"
SET "slug" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr("id", 1, 6)
WHERE "slug" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;
