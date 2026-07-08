import { auth } from "@/lib/auth";
import { UpstepWidget } from "@/components/UpstepWidget";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <>
      {children}
      <UpstepWidget {...(session?.user?.id ? { userId: session.user.id } : {})} />
    </>
  );
}
