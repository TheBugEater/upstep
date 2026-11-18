import type { Preferences } from "./api";

export type AlertPermission = {
  granted: boolean;
  canAskAgain: boolean;
  ios?: { status: number; allowsAlert?: boolean | null };
};
export function alertPermissionAction(
  permission: AlertPermission,
): "allowed" | "request" | "settings" {
  // Provisional iOS authorization delivers quietly and is not the alert opt-in.
  if (
    permission.granted &&
    permission.ios?.status !== 3 &&
    permission.ios?.allowsAlert !== false
  )
    return "allowed";
  if (
    !permission.canAskAgain ||
    (permission.ios?.status === 2 && permission.ios.allowsAlert === false)
  )
    return "settings";
  return "request";
}

export type SetupChoice = "enabled" | "later";
export function shouldOfferAlertSetup(
  choice: SetupChoice | null,
  ready: boolean,
  needsFirstPermission = false,
) {
  return (
    (choice === null || (choice === "enabled" && needsFirstPermission)) &&
    !ready
  );
}

// Each step can outlive its screen (OS prompts, token fetches, server changes).
// Fence before every write, and remember completion only after server opt-in.
export async function activateProjectAlerts(
  onCall: boolean,
  ports: {
    isCurrent(): boolean;
    register(): Promise<unknown>;
    save(preferences: Preferences): Promise<unknown>;
    remember(choice: SetupChoice): Promise<unknown>;
  },
) {
  const assertCurrent = () => {
    if (!ports.isCurrent())
      throw new Error("Your account or project changed. Please try again.");
  };
  assertCurrent();
  await ports.register();
  assertCurrent();
  const preference: Preferences = { enabled: true, onCall, quietUntil: null };
  await ports.save(preference);
  assertCurrent();
  await ports.remember("enabled");
  assertCurrent();
  return preference;
}
