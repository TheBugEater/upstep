-- CreateEnum
CREATE TYPE "AvatarSource" AS ENUM ('GITHUB', 'GOOGLE', 'INITIALS');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarSource" "AvatarSource";

-- Backfill: User.image was copied from the sign-up provider's profile, so
-- attribute it to the matching linked account by image host. Later sign-ins
-- refresh every account's picture.
UPDATE "Account" a
SET "image" = u."image"
FROM "User" u
WHERE a."userId" = u."id"
  AND u."image" IS NOT NULL
  AND (
    (a."provider" = 'github' AND u."image" LIKE 'https://avatars.githubusercontent.com/%')
    OR (a."provider" = 'google' AND u."image" ~ '^https://lh[0-9]+\.googleusercontent\.com/')
  );

-- Backfill: keep showing the picture each user already has.
UPDATE "User" u
SET "avatarSource" = CASE a."provider" WHEN 'github' THEN 'GITHUB'::"AvatarSource" ELSE 'GOOGLE'::"AvatarSource" END
FROM "Account" a
WHERE a."userId" = u."id"
  AND a."image" IS NOT NULL
  AND a."image" = u."image"
  AND a."provider" IN ('github', 'google');
