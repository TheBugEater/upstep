import React from "react";
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { resolveColorOverrides } from "@upstep/js/theme";
import { useUpstep } from "./FeedbackContext";
import { readableTextOn, useScaledStyles } from "./theme";

interface Props {
  position?: "bottom-right" | "bottom-left";
  label?: string;
  icon?: React.ReactNode;
}

export function FeedbackButton({ position = "bottom-right", label = "Feedback", icon }: Props) {
  const styles = useScaledStyles(baseStyles);
  const { openSheet, accentColor, supportUnread, colors, theme } = useUpstep();
  const scheme = useColorScheme();
  const mode =
    theme === "dark" || (theme === "auto" && scheme === "dark") ? "dark" : "light";
  const onAccent =
    resolveColorOverrides(colors, mode).accentText ?? readableTextOn(accentColor);

  return (
    <TouchableOpacity
      onPress={openSheet}
      style={[
        styles.btn,
        { backgroundColor: accentColor },
        position === "bottom-left" ? styles.left : styles.right,
      ]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        supportUnread > 0
          ? `${label}, ${supportUnread} unread ${supportUnread === 1 ? "message" : "messages"}`
          : label
      }
    >
      {icon ?? <ChatIcon color={onAccent} />}
      <Text style={[styles.label, { color: onAccent }]}>{label}</Text>
      {supportUnread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {supportUnread > 9 ? "9+" : supportUnread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ChatIcon({ color }: { color: string }) {
  // A glyph, so its corners stay fixed whatever the widget radius.
  const styles = baseStyles;
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconBubble, { borderColor: color }]} />
      <View style={[styles.iconTail, { borderColor: color }]} />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  btn: {
    position: "absolute",
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 100,
  },
  right: { right: 20 },
  left: { left: 20 },
  label: { color: "#fff", fontSize: 14, fontWeight: "600" },
  badge: {
    position: "absolute",
    top: -7,
    right: -5,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#171717",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  iconWrap: { width: 16, height: 16, position: "relative" },
  iconBubble: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 2,
    bottom: 3,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  iconTail: {
    position: "absolute",
    bottom: 0,
    left: 3,
    width: 5,
    height: 5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: "#fff",
    transform: [{ rotate: "45deg" }],
  },
});
