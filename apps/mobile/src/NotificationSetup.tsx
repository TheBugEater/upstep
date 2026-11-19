import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Hand,
  Lock,
  MessageCircle,
  UserRound,
} from "lucide-react-native";
import { alertPermissionAction } from "./alert-setup";
import type { AlertSetupController } from "./use-alert-setup";
import { Brand, Button, Chip, SettingsRow, Toggle } from "./ui";
import type { Theme } from "./theme";

export function NotificationSetup({
  alerts,
  projectName,
  onChooseProject,
  onComplete,
  t,
}: {
  alerts: AlertSetupController;
  projectName: string;
  onChooseProject?(): void;
  onComplete?(): void;
  t: Theme;
}) {
  const [onCall, setOnCall] = useState(alerts.preference?.onCall ?? true);
  const [settingsError, setSettingsError] = useState("");
  const openSettings = () => {
    setSettingsError("");
    void Linking.openSettings().catch(() =>
      setSettingsError(
        "Open your phone’s Settings, find Upstep, and allow notifications.",
      ),
    );
  };
  if (alerts.success || (alerts.ready && !alerts.paused))
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }}
        >
          <Brand t={t} />
          <View
            style={{
              flexGrow: 1,
              flexShrink: 0,
              justifyContent: "center",
              gap: 20,
              paddingVertical: 24,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.colors.primary,
              }}
            >
              <Check size={34} strokeWidth={2.4} color={t.colors.onPrimary} />
            </View>
            <View style={{ gap: 10 }}>
              <Text style={t.styles.heroTitle}>You’re in the loop.</Text>
              <Text style={t.styles.body}>
                Customer alerts are on for {projectName}. Change your
                availability any time from your profile.
              </Text>
            </View>
            <View style={t.styles.group}>
              <SettingsRow
                title="This phone is connected"
                subtitle="Handoffs, assignments and replies can reach you."
                icon={Bell}
                t={t}
              />
              <View style={t.styles.divider} />
              <SettingsRow
                title={
                  alerts.preference?.onCall
                    ? "On call for new requests"
                    : "Assigned conversations only"
                }
                subtitle={
                  alerts.preference?.onCall
                    ? "You’ll also hear about unassigned requests."
                    : "You’ll hear about conversations assigned to you."
                }
                icon={UserRound}
                t={t}
              />
            </View>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingTop: 12, gap: 10 }}>
          <Button
            title="Open my inbox"
            icon={ArrowRight}
            primary
            onPress={onComplete || alerts.finish}
            t={t}
            style={{ minHeight: 54 }}
          />
          <Text style={[t.styles.small, { textAlign: "center" }]}>
            Focus modes and your phone’s settings can still silence alerts.
          </Text>
        </View>
      </View>
    );
  const needsSettings =
    !!alerts.permission &&
    alertPermissionAction(alerts.permission) === "settings";
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 16, gap: 22 }}
      >
        <View style={t.styles.row}>
          <Brand t={t} />
          <Chip title="Signed in" icon={Check} t={t} />
        </View>
        <View style={{ gap: 10, paddingTop: 8 }}>
          {onChooseProject ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Workspace: ${projectName}. Choose workspace for customer alerts`}
              disabled={alerts.busy}
              onPress={onChooseProject}
              style={({ pressed }) => [
                t.styles.inline,
                { gap: 4, alignSelf: "flex-start", minHeight: 32 },
                pressed && t.styles.pressed,
              ]}
            >
              <Text style={[t.styles.small, { fontWeight: "500" }]}>
                {projectName}
              </Text>
              <ChevronDown size={14} color={t.colors.faint} />
            </Pressable>
          ) : (
            <Text style={[t.styles.small, { fontWeight: "500" }]}>
              {projectName}
            </Text>
          )}
          <Text style={t.styles.heroTitle}>
            Know the moment someone’s waiting.
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <Text style={t.styles.sectionLabel}>You’ll get a tap when</Text>
          <View style={t.styles.group}>
            <SettingsRow
              title="AI hands off to a person"
              subtitle="The customer needs help AI can’t give."
              icon={Hand}
              t={t}
            />
            <View style={t.styles.divider} />
            <SettingsRow
              title="A conversation is assigned to you"
              icon={UserRound}
              t={t}
            />
            <View style={t.styles.divider} />
            <SettingsRow
              title="A customer replies to you"
              icon={MessageCircle}
              t={t}
            />
            <View style={t.styles.divider} />
            <SettingsRow
              title="I’m on call"
              subtitle="Also alert me for unassigned requests."
              t={t}
              end={
                <Toggle
                  label="On call for new customer requests"
                  value={onCall}
                  disabled={alerts.busy}
                  onValueChange={setOnCall}
                  t={t}
                />
              }
            />
          </View>
        </View>
        <View style={[t.styles.inline, { alignItems: "flex-start", gap: 12 }]}>
          <Lock size={18} color={t.colors.muted} strokeWidth={1.9} />
          <Text style={[t.styles.small, { flex: 1, color: t.colors.muted }]}>
            Your lock screen only says a customer needs you — never their name
            or what they wrote.
          </Text>
        </View>
      </ScrollView>
      <View style={{ gap: 6, paddingHorizontal: 24, paddingTop: 12 }}>
        {(!!alerts.problem || !!settingsError) && (
          <View
            style={{
              padding: 14,
              marginBottom: 6,
              backgroundColor: t.colors.note,
              borderRadius: 14,
            }}
          >
            <Text
              accessibilityRole="alert"
              style={[t.styles.text, { color: t.colors.noteText }]}
            >
              {settingsError ||
                (needsSettings
                  ? "Notifications are off in your phone’s settings. Allow them there, then come back to finish."
                  : alerts.problem)}
            </Text>
          </View>
        )}
        {alerts.checking && <ActivityIndicator color={t.colors.text} />}
        <Button
          title={
            alerts.busy
              ? "Connecting your phone…"
              : !alerts.loaded
                ? "Retry connection"
                : needsSettings
                  ? "Open phone settings"
                  : "Turn on alerts"
          }
          primary
          disabled={alerts.busy || alerts.checking}
          onPress={() =>
            !alerts.loaded
              ? void alerts.retry()
              : needsSettings
                ? openSettings()
                : void alerts.enable(onCall)
          }
          t={t}
          style={{ minHeight: 54 }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={alerts.busy}
          onPress={() => void alerts.later()}
          style={({ pressed }) => [
            { minHeight: 44, alignItems: "center", justifyContent: "center" },
            pressed && t.styles.pressed,
          ]}
        >
          <Text style={[t.styles.label, { fontWeight: "500", color: t.colors.muted }]}>
            Not now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AlertBanner({
  alerts,
  t,
}: {
  alerts: AlertSetupController;
  t: Theme;
}) {
  if (alerts.checking || (alerts.ready && !alerts.paused)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        alerts.paused ? "Resume customer alerts" : "Set up customer alerts"
      }
      onPress={alerts.open}
      style={({ pressed }) => [
        {
          marginHorizontal: 20,
          marginBottom: 12,
          backgroundColor: t.colors.surface,
          borderWidth: 1,
          borderColor: t.colors.line,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        pressed && t.styles.pressed,
      ]}
    >
      <Bell size={18} color={t.colors.text} strokeWidth={1.9} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[t.styles.label, { fontSize: 14 }]}>
          {alerts.paused ? "Alerts are paused" : "Alerts are off"}
        </Text>
        <Text style={t.styles.small}>
          {alerts.paused
            ? "Tap to get back in the loop."
            : "Get a tap when a customer needs you."}
        </Text>
      </View>
      <ArrowRight size={17} color={t.colors.faint} />
    </Pressable>
  );
}
