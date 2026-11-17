import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { validChallenge } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";
export default async function MobileConnect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const challenge =
    typeof params.challenge === "string" ? params.challenge : "";
  const state = typeof params.state === "string" ? params.state : "";
  if (!validChallenge(challenge) || !validChallenge(state))
    return (
      <main className="p-8">
        Open sign-in from the Upstep mobile app to continue.
      </main>
    );
  const session = await auth();
  if (!session?.user?.id) {
    const returnTo = `/mobile/connect?challenge=${challenge}&state=${state}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="max-w-sm rounded-2xl border border-line bg-card p-7">
        <p className="text-sm text-muted">Upstep for iPhone and Android</p>
        <h1 className="mt-3 text-2xl font-semibold text-ink">
          Connect your support inbox
        </h1>
        <p className="mt-3 text-sm text-muted">
          Continue as {session.user.email}. This device will be able to read and
          reply to support conversations in projects you can access.
        </p>
        <form action="/api/mobile/authorize" method="post" className="mt-6">
          <input type="hidden" name="challenge" value={challenge} />
          <input type="hidden" name="state" value={state} />
          <button className="w-full rounded-xl bg-primary px-4 py-3 text-primary-fg font-medium">
            Continue to Upstep app
          </button>
        </form>
      </div>
    </main>
  );
}
