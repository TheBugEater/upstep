import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Sparkles,
} from "lucide-react-native";
import { Brand, Button, NotificationArt } from "./ui";
import type { Theme } from "./theme";

export function Welcome({
  t,
  busy,
  error,
  server,
  onLogin,
  onServer,
  onRetry,
}: {
  t: Theme;
  busy: boolean;
  error: string;
  server: string;
  onLogin(): void;
  onServer(): void;
  onRetry(): void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          t.styles.row,
          { paddingHorizontal: 26, paddingTop: 20, paddingBottom: 10 },
        ]}
      >
        <Brand t={t} />
        <Text style={t.styles.eyebrow}>SUPPORT, ON THE GO</Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 26,
          paddingVertical: 20,
          gap: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flexGrow: 1,
            flexShrink: 0,
            justifyContent: "center",
            gap: 28,
            paddingVertical: 16,
          }}
        >
          <NotificationArt t={t} />
          <View style={{ gap: 14 }}>
            <Text style={t.styles.heroTitle}>
              Be there.{"\n"}From anywhere.
            </Text>
            <Text style={t.styles.body}>
              A human touch, just a tap away. Get the heads-up, pick up where AI
              left off, and make someone’s day.
            </Text>
          </View>
          <View style={t.styles.inline}>
            <View
              style={[
                t.styles.avatar,
                { width: 34, height: 34, borderRadius: 11 },
              ]}
            >
              <Sparkles size={16} color={t.colors.forest} />
            </View>
            <Text style={[t.styles.small, { flex: 1 }]}>
              AI handles the everyday. You handle the moments that matter.
            </Text>
          </View>
        </View>
        {!!error && (
          <View style={[t.styles.card, { borderColor: t.colors.error }]}>
            <Text
              accessibilityRole="alert"
              style={[t.styles.text, { color: t.colors.error }]}
            >
              {error}
            </Text>
            <Button title="Try again" onPress={onRetry} t={t} />
          </View>
        )}
      </ScrollView>
      <View
        style={{
          gap: 12,
          paddingHorizontal: 26,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <Button
          title={busy ? "Opening sign-in…" : "Get started"}
          icon={ArrowRight}
          onPress={onLogin}
          disabled={busy}
          primary
          t={t}
          style={{ minHeight: 56, borderRadius: 17 }}
        />
        <View style={[t.styles.inline, { justifyContent: "center", gap: 5 }]}>
          <ShieldCheck size={13} color={t.colors.muted} />
          <Text style={t.styles.small}>
            Sign in with your existing Upstep account
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change Upstep server"
          onPress={onServer}
          disabled={busy}
          style={{
            alignSelf: "center",
            minHeight: 44,
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
          }}
        >
          <View style={[t.styles.statusDot, { width: 5, height: 5 }]} />
          <Text style={t.styles.small}>
            {server.replace(/^https?:\/\//, "")}
          </Text>
          <ChevronDown size={12} color={t.colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
