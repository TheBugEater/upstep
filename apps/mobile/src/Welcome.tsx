import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
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
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <Brand t={t} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
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
            gap: 36,
            paddingVertical: 12,
          }}
        >
          <NotificationArt t={t} />
          <View style={{ gap: 12 }}>
            <Text style={t.styles.heroTitle}>
              Step in when the AI steps back.
            </Text>
            <Text style={t.styles.body}>
              Get a tap when a customer needs a person. Reply, hand back to AI
              or resolve, wherever you are.
            </Text>
          </View>
        </View>
        {!!error && (
          <View
            style={[
              t.styles.card,
              { backgroundColor: t.colors.errorTint, borderWidth: 0 },
            ]}
          >
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
      <View style={{ gap: 6, paddingHorizontal: 24, paddingBottom: 4 }}>
        <Button
          title={busy ? "Opening sign-in…" : "Sign in to Upstep"}
          icon={busy ? undefined : ArrowRight}
          onPress={onLogin}
          disabled={busy}
          primary
          t={t}
          style={{ minHeight: 54 }}
        />
        <Text style={[t.styles.small, { textAlign: "center", paddingTop: 4 }]}>
          Use the Google or GitHub account you use on the web.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Upstep server: ${server.replace(/^https?:\/\//, "")}. Change server`}
          onPress={onServer}
          disabled={busy}
          style={({ pressed }) => [
            {
              alignSelf: "center",
              minHeight: 44,
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
            },
            pressed && t.styles.pressed,
          ]}
        >
          <Text style={t.styles.small}>Server</Text>
          <Text style={[t.styles.small, { color: t.colors.body, fontWeight: "600" }]}>
            {server.replace(/^https?:\/\//, "")}
          </Text>
          <Text style={[t.styles.small, { color: t.colors.clay, fontWeight: "600" }]}>
            Change
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
