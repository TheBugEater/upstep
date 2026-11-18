import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { api } from "./client";
import { projectPath, type Preferences, type ProjectDetails } from "./api";
import { registerNotifications } from "./notifications";
import {
  activateProjectAlerts,
  alertPermissionAction,
  shouldOfferAlertSetup,
  type AlertPermission,
  type SetupChoice,
} from "./alert-setup";

type Snapshot = {
  context: string;
  loaded: boolean;
  checking: boolean;
  preference: Preferences | null;
  permission: AlertPermission | null;
  registered: boolean;
  problem: string;
};
const empty = (context: string): Snapshot => ({
  context,
  loaded: false,
  checking: true,
  preference: null,
  permission: null,
  registered: false,
  problem: "",
});
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Could not set up alerts. Please try again.";

export function useAlertSetup(
  userId: string | undefined,
  projectId: string | null,
  origin: string,
  active: boolean,
) {
  const context =
    userId && projectId ? JSON.stringify([origin, userId, projectId]) : "";
  const current = useRef(context);
  current.current = context;
  const mounted = useRef(true);
  const reads = useRef(0);
  const working = useRef(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => empty(context));
  const [showFor, setShowFor] = useState("");
  const [successFor, setSuccessFor] = useState("");
  const [busyFor, setBusyFor] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const key = useCallback(
    async () =>
      `upstep.mobile.alerts.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, context)}`,
    [context],
  );
  const check = useCallback(async () => {
    if (!context || !projectId || working.current) return;
    const run = ++reads.current;
    const epoch = api.sessionGeneration;
    const valid = () =>
      mounted.current &&
      current.current === context &&
      reads.current === run &&
      api.sessionGeneration === epoch;
    let choice: SetupChoice | null = null;
    try {
      const saved = await key().then((k) => SecureStore.getItemAsync(k));
      choice = saved === "enabled" || saved === "later" ? saved : null;
      if (!valid()) return;
      const [details, permission] = await Promise.all([
        api.request<ProjectDetails>(projectPath(projectId)),
        Notifications.getPermissionsAsync(),
      ]);
      if (!valid()) return;
      let registered = false;
      let problem = "";
      if (
        details.preference?.enabled &&
        alertPermissionAction(permission) === "allowed"
      ) {
        // A slow push provider must not hold up an existing teammate's inbox.
        setSnapshot((old) => ({
          context,
          loaded: true,
          checking: true,
          preference: details.preference,
          permission,
          registered: old.context === context && old.registered,
          problem: "",
        }));
        try {
          await registerNotifications({ requestPermission: false });
          registered = true;
        } catch (error) {
          problem = message(error);
        }
      }
      if (!valid()) return;
      const ready =
        !!details.preference?.enabled &&
        registered &&
        alertPermissionAction(permission) === "allowed";
      if (ready && !choice) {
        const k = await key();
        if (!valid()) return;
        await SecureStore.setItemAsync(k, "enabled", {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (!valid()) return;
      }
      setSnapshot({
        context,
        loaded: true,
        checking: false,
        preference: details.preference,
        permission,
        registered,
        problem,
      });
      if (
        shouldOfferAlertSetup(
          choice,
          ready,
          permission.status === "undetermined" || permission.ios?.status === 0,
        )
      )
        setShowFor(context);
    } catch (error) {
      if (!valid()) return;
      setSnapshot({
        ...empty(context),
        checking: false,
        problem: message(error),
      });
      if (!choice) setShowFor(context);
    }
  }, [context, projectId, key]);
  useEffect(() => {
    reads.current++;
    working.current = false;
    setSnapshot(empty(context));
    setShowFor("");
    setSuccessFor("");
    setBusyFor("");
  }, [context, check]);
  useEffect(() => {
    if (active && context) void check();
  }, [active, check, context]);
  useEffect(() => {
    if (!context) return;
    const listener = Notifications.addPushTokenListener((token) => {
      if (working.current) return;
      void registerNotifications({
        requestPermission: false,
        devicePushToken: token,
      }).catch((error) => {
        if (mounted.current && current.current === context)
          setSnapshot((old) => ({
            ...old,
            registered: false,
            problem: message(error),
          }));
      });
    });
    return () => listener.remove();
  }, [context, check]);
  const enable = async (onCall: boolean) => {
    if (!context || !projectId || working.current) return;
    working.current = true;
    reads.current++;
    const epoch = api.sessionGeneration;
    const valid = () =>
      mounted.current &&
      current.current === context &&
      api.sessionGeneration === epoch;
    setBusyFor(context);
    setSnapshot((old) => ({ ...old, problem: "" }));
    try {
      const preference = await activateProjectAlerts(onCall, {
        isCurrent: valid,
        register: () => registerNotifications(),
        save: (value) => api.request(projectPath(projectId), "PUT", value),
        remember: async (choice) => {
          const k = await key();
          if (!valid()) throw new Error("Your sign-in changed.");
          await SecureStore.setItemAsync(k, choice, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        },
      });
      if (!valid()) return;
      const permission = await Notifications.getPermissionsAsync();
      if (!valid()) return;
      setSnapshot({
        context,
        loaded: true,
        checking: false,
        preference,
        permission,
        registered: true,
        problem: "",
      });
      setSuccessFor(context);
    } catch (error) {
      const permission = await Notifications.getPermissionsAsync().catch(
        () => null,
      );
      if (valid())
        setSnapshot((old) => ({
          ...old,
          permission,
          registered: false,
          problem: message(error),
        }));
    } finally {
      if (valid()) {
        working.current = false;
        setBusyFor("");
      }
    }
  };
  const later = async () => {
    if (!context || working.current) return;
    working.current = true;
    reads.current++;
    setBusyFor(context);
    try {
      const k = await key();
      if (!mounted.current || current.current !== context) return;
      await SecureStore.setItemAsync(k, "later", {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (mounted.current && current.current === context) setShowFor("");
    } catch (error) {
      if (mounted.current && current.current === context)
        setSnapshot((old) => ({ ...old, problem: message(error) }));
    } finally {
      if (mounted.current && current.current === context) {
        working.current = false;
        setBusyFor("");
      }
    }
  };
  const value = snapshot.context === context ? snapshot : empty(context);
  const paused =
    !!value.preference?.quietUntil &&
    Date.parse(value.preference.quietUntil) > Date.now();
  return {
    ...value,
    busy: busyFor === context && !!context,
    showSetup: showFor === context && !!context,
    success: successFor === context && !!context,
    ready:
      value.registered &&
      !!value.preference?.enabled &&
      !!value.permission &&
      alertPermissionAction(value.permission) === "allowed",
    paused,
    context,
    enable,
    later,
    retry: check,
    open: () => {
      setSuccessFor("");
      setShowFor(context);
    },
    finish: () => {
      setShowFor("");
      setSuccessFor("");
    },
  };
}
export type AlertSetupController = ReturnType<typeof useAlertSetup>;
