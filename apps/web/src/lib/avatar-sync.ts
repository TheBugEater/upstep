import { db } from "./db";
import { avatarFromProfile, resolveAvatar, sourceForProvider, type AvatarSource } from "./avatar";

/**
 * Recompute `User.image` (the effective avatar every dashboard query reads)
 * from the user's choice and their linked accounts' pictures.
 */
export async function refreshUserAvatar(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { image: true, avatarSource: true, accounts: { select: { provider: true, image: true, createdAt: true } } },
  });
  if (!user) return null;
  const image = resolveAvatar({ source: user.avatarSource, accounts: user.accounts });
  if (image !== user.image) await db.user.update({ where: { id: userId }, data: { image } });
  return image;
}

/** Store the picture from this sign-in's provider profile, then refresh the effective avatar. */
export async function recordSignInAvatar(input: {
  userId: string;
  provider: string;
  providerAccountId: string;
  profile: unknown;
  isNewUser: boolean;
}): Promise<void> {
  const image = avatarFromProfile(input.provider, input.profile);
  if (image) {
    await db.account.updateMany({
      where: { provider: input.provider, providerAccountId: input.providerAccountId, userId: input.userId },
      data: { image },
    });
  }
  const source: AvatarSource | null = sourceForProvider(input.provider);
  if (input.isNewUser && source) {
    // New users see the picture from the provider they signed up with.
    await db.user.updateMany({ where: { id: input.userId, avatarSource: null }, data: { avatarSource: source } });
  }
  await refreshUserAvatar(input.userId);
}

/** Save the user's picker choice and return the new effective avatar. */
export async function setAvatarSource(userId: string, source: AvatarSource): Promise<string | null> {
  await db.user.update({ where: { id: userId }, data: { avatarSource: source } });
  return refreshUserAvatar(userId);
}
