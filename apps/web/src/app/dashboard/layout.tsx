import { UpstepWidget } from "@/components/UpstepWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <UpstepWidget />
    </>
  );
}
