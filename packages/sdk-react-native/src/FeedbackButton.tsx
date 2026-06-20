import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useUpstep } from "./FeedbackContext";

interface Props {
  position?: "bottom-right" | "bottom-left";
  label?: string;
}

export function FeedbackButton({ position = "bottom-right", label = "Feedback" }: Props) {
  const { openSheet, accentColor } = useUpstep();

  return (
    <TouchableOpacity
      onPress={openSheet}
      style={[
        styles.btn,
        { backgroundColor: accentColor },
        position === "bottom-left" ? styles.left : styles.right,
      ]}
      activeOpacity={0.85}
    >
      <Text style={styles.icon}>💬</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  icon: { fontSize: 14 },
  label: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
