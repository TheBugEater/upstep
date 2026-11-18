import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react-native";
import { alertPermissionAction } from "./alert-setup";
import type { AlertSetupController } from "./use-alert-setup";
import { Brand, Button, NotificationArt, SettingsRow } from "./ui";
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
          contentContainerStyle={{ flexGrow: 1, padding: 28, gap: 24 }}
        >
          <Brand t={t} />
          <View
            style={{
              flexGrow: 1,
              flexShrink: 0,
              justifyContent: "center",
              gap: 24,
              paddingVertical: 30,
            }}
          >
            <View
              style={{
                width: 110,
                height: 110,
                borderRadius: 38,
                alignSelf: "center",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.colors.accent,
                marginBottom: 12,
              }}
            >
              <Bell size={44} strokeWidth={1.4} color={t.colors.ink} />
              <View
                style={{
                  position: "absolute",
                  right: -5,
                  bottom: 1,
                  padding: 7,
                  borderRadius: 20,
                  backgroundColor: t.colors.forest,
                  borderWidth: 4,
                  borderColor: t.colors.bg,
                }}
              >
                <Check size={18} color={t.colors.onForest} />
              </View>
            </View>
            <Text
              style={[
                t.styles.heroTitle,
                { textAlign: "center", fontSize: 37, lineHeight: 43 },
              ]}
            >
              You’re in the loop.
            </Text>
            <Text style={[t.styles.body, { textAlign: "center" }]}>
              Customer alerts are enabled for {projectName}. You can change your
              availability any time.
            </Text>
            <View style={t.styles.card}>
              <SettingsRow
                title="This phone is connected"
                subtitle="Assignments and customer replies can reach you."
                icon={CheckCheck}
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
                    ? "Your team can reach you when a customer needs a person."
                    : "You’ll hear about conversations assigned to you."
                }
                icon={Users}
                t={t}
              />
            </View>
          </View>
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 28,
            paddingTop: 12,
            paddingBottom: 8,
            gap: 12,
          }}
        >
          <Button
            title="Open my inbox"
            icon={ArrowRight}
            primary
            onPress={onComplete || alerts.finish}
            t={t}
            style={{ minHeight: 56 }}
          />
          <Text style={[t.styles.small, { textAlign: "center" }]}>
            Focus mode and your phone’s settings can silence alerts.
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
        contentContainerStyle={{ padding: 26, paddingBottom: 16, gap: 22 }}
      >
        <View style={t.styles.row}>
          <Brand t={t} />
          <View style={t.styles.inline}>
            <Check size={13} color={t.colors.forest} />
            <Text style={t.styles.eyebrow}>SIGNED IN</Text>
          </View>
        </View>
        {onChooseProject && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose workspace for customer alerts"
            disabled={alerts.busy}
            onPress={onChooseProject}
            style={[
              t.styles.inline,
              {
                alignSelf: "flex-start",
                backgroundColor: t.colors.soft,
                borderRadius: 12,
                paddingHorizontal: 12,
                minHeight: 40,
              },
            ]}
          >
            <Users size={14} color={t.colors.forest} />
            <Text
              style={[
                t.styles.small,
                { color: t.colors.forest, fontWeight: "600", flexShrink: 1 },
              ]}
            >
              {projectName}
            </Text>
            <ChevronDown size={13} color={t.colors.forest} />
          </Pressable>
        )}
        <View style={{ gap: 12, paddingTop: 8 }}>
          <Text style={t.styles.eyebrow}>ONE LAST THING</Text>
          <Text style={[t.styles.heroTitle, { fontSize: 37, lineHeight: 42 }]}>
            Be there when{"\n"}you’re needed.
          </Text>
          <Text style={t.styles.body}>
            Turn on customer alerts so you can step in, even when Upstep isn’t
            open.
          </Text>
        </View>
        <NotificationArt t={t} />
        <View style={{ gap: 18 }}>
          <SettingsRow
            title="Know when you’re needed"
            subtitle="Human handoffs, assignments, and customer replies."
            icon={MessageCircle}
            t={t}
          />
          <SettingsRow
            title="Customer details stay private"
            subtitle="Message content is hidden on the lock screen."
            icon={ShieldCheck}
            t={t}
          />
        </View>
      </ScrollView>
      <View
        style={{
          gap: 8,
          paddingHorizontal: 26,
          paddingTop: 12,
          paddingBottom: 4,
          borderTopWidth: 1,
          borderColor: t.colors.line,
        }}
      >
        <View style={{ paddingBottom: 4 }}>
          <SettingsRow
            title="On call for new requests"
            subtitle="Include unassigned requests."
            t={t}
            end={
              <Switch
                accessibilityLabel="On call for new customer requests"
                value={onCall}
                disabled={alerts.busy}
                onValueChange={setOnCall}
                trackColor={{ true: t.colors.forest }}
                thumbColor={t.colors.card}
              />
            }
          />
        </View>
        {(!!alerts.problem || !!settingsError) && (
          <View
            style={{
              padding: 14,
              backgroundColor: t.colors.amberBg,
              borderRadius: 14,
            }}
          >
            <Text
              accessibilityRole="alert"
              style={[t.styles.text, { color: t.colors.amber }]}
            >
              {settingsError ||
                (needsSettings
                  ? "Notifications are off in your phone’s settings. Allow them there, then return to finish setup."
                  : alerts.problem)}
            </Text>
          </View>
        )}
        {alerts.checking && <ActivityIndicator color={t.colors.forest} />}
        <Button
          title={
            alerts.busy
              ? "Connecting your phone…"
              : !alerts.loaded
                ? "Retry connection"
                : needsSettings
                  ? "Open phone settings"
                  : "Enable customer alerts"
          }
          icon={Bell}
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
          style={{ minHeight: 56, borderRadius: 17 }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={alerts.busy}
          onPress={() => void alerts.later()}
          style={{
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={[t.styles.small, { fontWeight: "600" }]}>
            Not now — I’ll check the inbox myself
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
          marginBottom: 18,
          backgroundColor: t.colors.soft,
          borderRadius: 17,
          padding: 15,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        pressed && t.styles.pressed,
      ]}
    >
      <View
        style={[
          t.styles.iconButton,
          { width: 38, height: 38, borderRadius: 12 },
        ]}
      >
        <Bell size={18} color={t.colors.forest} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[t.styles.label, { fontSize: 13 }]}>
          {alerts.paused
            ? "Your customer alerts are paused"
            : "Your customer alerts aren’t ready"}
        </Text>
        <Text style={t.styles.small}>
          {alerts.paused
            ? "Tap to get back in the loop."
            : "Get a heads-up when a customer needs you."}
        </Text>
      </View>
      <ArrowRight size={17} color={t.colors.forest} />
    </Pressable>
  );
}
