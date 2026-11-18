import assert from "node:assert/strict";
import test from "node:test";
import {
  activateProjectAlerts,
  alertPermissionAction,
  shouldOfferAlertSetup,
} from "../../../mobile/src/alert-setup";

test("alert onboarding distinguishes interrupting alerts from quiet or denied permission", () => {
  assert.equal(
    alertPermissionAction({ granted: true, canAskAgain: true }),
    "allowed",
  );
  assert.equal(
    alertPermissionAction({ granted: false, canAskAgain: true }),
    "request",
  );
  assert.equal(
    alertPermissionAction({ granted: false, canAskAgain: false }),
    "settings",
  );
  assert.equal(
    alertPermissionAction({
      granted: true,
      canAskAgain: true,
      ios: { status: 3 },
    }),
    "request",
  );
  assert.equal(
    alertPermissionAction({
      granted: true,
      canAskAgain: false,
      ios: { status: 3 },
    }),
    "settings",
  );
  assert.equal(
    alertPermissionAction({
      granted: true,
      canAskAgain: true,
      ios: { status: 2, allowsAlert: false },
    }),
    "settings",
  );
  assert.equal(
    alertPermissionAction({
      granted: true,
      canAskAgain: true,
      ios: { status: 2, allowsAlert: true },
    }),
    "allowed",
  );
});

test("a first setup is offered, while a deliberate skip or prior opt-in is remembered", () => {
  assert.equal(shouldOfferAlertSetup(null, false), true);
  assert.equal(shouldOfferAlertSetup(null, true), false);
  assert.equal(shouldOfferAlertSetup("later", false), false);
  assert.equal(shouldOfferAlertSetup("enabled", false), false);
  assert.equal(shouldOfferAlertSetup("enabled", false, true), true);
  assert.equal(shouldOfferAlertSetup("later", false, true), false);
});

test("completion follows phone registration and a successful project opt-in", async () => {
  const calls: unknown[] = [];
  const result = await activateProjectAlerts(false, {
    isCurrent: () => true,
    register: async () => {
      calls.push("registered");
    },
    save: async (preference) => {
      calls.push(preference);
    },
    remember: async (choice) => {
      calls.push(choice);
    },
  });
  assert.deepEqual(result, { enabled: true, onCall: false, quietUntil: null });
  assert.deepEqual(calls, ["registered", result, "enabled"]);
});

test("permission denial or failed phone registration never opts the project in", async () => {
  const calls: string[] = [];
  await assert.rejects(
    activateProjectAlerts(true, {
      isCurrent: () => true,
      register: async () => {
        throw new Error("Permission denied");
      },
      save: async () => {
        calls.push("save");
      },
      remember: async () => {
        calls.push("remember");
      },
    }),
    /Permission denied/,
  );
  assert.deepEqual(calls, []);
});

test("a failed backend opt-in cannot be remembered as completed onboarding", async () => {
  let remembered = false;
  await assert.rejects(
    activateProjectAlerts(true, {
      isCurrent: () => true,
      register: async () => {},
      save: async () => {
        throw new Error("Offline");
      },
      remember: async () => {
        remembered = true;
      },
    }),
    /Offline/,
  );
  assert.equal(remembered, false);
});

test("switching account, server, or project during permission setup prevents a stale opt-in", async () => {
  let current = true;
  let saved = false;
  await assert.rejects(
    activateProjectAlerts(true, {
      isCurrent: () => current,
      register: async () => {
        current = false;
      },
      save: async () => {
        saved = true;
      },
      remember: async () => {
        throw new Error("Must not remember stale setup");
      },
    }),
    /account or project changed/,
  );
  assert.equal(saved, false);
});

test("a project change during backend save cannot complete the new project's onboarding", async () => {
  let current = true;
  let remembered = false;
  await assert.rejects(
    activateProjectAlerts(true, {
      isCurrent: () => current,
      register: async () => {},
      save: async () => {
        current = false;
      },
      remember: async () => {
        remembered = true;
      },
    }),
    /account or project changed/,
  );
  assert.equal(remembered, false);
});
