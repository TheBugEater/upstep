/**
 * Self-hosted installs set `UPSTEP_SELF_HOSTED=true`. Every account then gets
 * every feature with no plan limits and no billing: the operator pays for
 * their own server, database and AI provider, so hosted pricing tiers don't
 * apply. Upstep Cloud leaves it unset.
 */
export function isSelfHosted() {
  return /^(1|true|yes|on)$/i.test(
    process.env.UPSTEP_SELF_HOSTED?.trim() || "",
  );
}

/**
 * "No limit" for counters stored in Postgres integer columns or used as
 * database filters, where `Infinity` can't be sent.
 */
export const UNLIMITED_COUNT = 2_147_483_647;

/** Website pages the support AI learns from per project on a self-hosted install. */
export const SELF_HOSTED_SUPPORT_PAGES = 500;
