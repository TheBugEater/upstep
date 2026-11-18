import React from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import type { Theme } from "./theme";

export function Button({
  title,
  onPress,
  primary = false,
  disabled = false,
  icon: Icon,
  t,
  style,
}: {
  title: string;
  onPress(): void;
  primary?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  t: Theme;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        t.styles.button,
        primary && t.styles.primary,
        style,
        pressed && t.styles.pressed,
        disabled && t.styles.disabled,
      ]}
    >
      {Icon && (
        <Icon
          size={17}
          strokeWidth={1.8}
          color={primary ? t.colors.onForest : t.colors.text}
        />
      )}
      <Text style={[t.styles.buttonText, primary && t.styles.primaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon: Icon,
  onPress,
  t,
  disabled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress(): void;
  t: Theme;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={5}
      style={({ pressed }) => [
        t.styles.iconButton,
        pressed && t.styles.pressed,
        disabled && t.styles.disabled,
      ]}
    >
      <Icon size={20} strokeWidth={1.8} color={t.colors.text} />
    </Pressable>
  );
}
export function Brand({ t }: { t: Theme }) {
  return (
    <View
      style={[t.styles.inline, { gap: 7 }]}
      accessibilityLabel="Upstep support"
    >
      <View
        style={{
          width: 29,
          height: 29,
          backgroundColor: t.colors.forest,
          borderRadius: 9,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowUpRight size={22} strokeWidth={2.5} color={t.colors.onForest} />
      </View>
      <Text style={t.styles.brand}>upstep</Text>
    </View>
  );
}
export function Avatar({
  name,
  t,
  size = 44,
}: {
  name: string;
  t: Theme;
  size?: number;
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "V";
  return (
    <View
      style={[
        t.styles.avatar,
        { width: size, height: size, borderRadius: size * 0.34 },
      ]}
    >
      <Text style={[t.styles.avatarText, { fontSize: size * 0.34 }]}>
        {initials}
      </Text>
    </View>
  );
}
export function Badge({
  title,
  t,
  kind = "neutral",
}: {
  title: string;
  t: Theme;
  kind?: "neutral" | "human" | "ai" | "resolved";
}) {
  const Icon =
    kind === "ai"
      ? Sparkles
      : kind === "resolved"
        ? Check
        : kind === "human"
          ? MessageCircle
          : undefined;
  const color = kind === "human" ? t.colors.amber : t.colors.forest;
  return (
    <View
      style={[
        t.styles.pill,
        kind === "human" && { backgroundColor: t.colors.amberBg },
      ]}
    >
      {Icon && <Icon size={11} color={color} strokeWidth={2} />}
      <Text style={[t.styles.pillText, { color }]}>{title}</Text>
    </View>
  );
}
export function NotificationArt({
  t,
  large = false,
}: {
  t: Theme;
  large?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: "100%",
        minHeight: large ? 250 : 202,
        borderRadius: 28,
        backgroundColor: t.colors.hero,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: 230,
          height: 230,
          borderRadius: 115,
          borderWidth: 1,
          borderColor: "#49684a",
          right: -65,
          top: -90,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 90,
          borderWidth: 1,
          borderColor: "#49684a",
          left: -80,
          bottom: -110,
        }}
      />
      <View style={{ position: "absolute", right: 31, top: 24 }}>
        <Sparkles size={20} color="#b3d992" strokeWidth={1.5} />
      </View>
      <View
        style={[
          {
            width: "100%",
            maxWidth: 320,
            backgroundColor: "#f8fbf3",
            borderRadius: 20,
            padding: 17,
            gap: 13,
            transform: [{ rotate: "-3deg" }],
          },
          t.styles.shadow,
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View
              style={{
                backgroundColor: "#204c38",
                width: 20,
                height: 20,
                borderRadius: 6,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowUpRight size={15} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#204c38",
                fontSize: 10,
                fontWeight: "700",
                letterSpacing: 1,
              }}
            >
              UPSTEP
            </Text>
          </View>
          <Text style={{ color: "#82907e", fontSize: 10 }}>now</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: "#e7efdc",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={21} strokeWidth={1.6} color="#204c38" />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#182e25" }}>
              A customer needs your help
            </Text>
            <Text style={{ fontSize: 11, color: "#77837b" }}>
              Your next great conversation starts here.
            </Text>
          </View>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 7,
          alignItems: "center",
          marginTop: 22,
        }}
      >
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: "#d7efaa",
          }}
        />
        <Text style={{ color: "#d4e1cb", fontSize: 10, letterSpacing: 0.3 }}>
          A little heads-up. A big difference.
        </Text>
      </View>
    </View>
  );
}
export function SettingsRow({
  title,
  subtitle,
  icon: Icon,
  onPress,
  t,
  end,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  t: Theme;
  end?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={[t.styles.inline, { flex: 1 }]}>
        {Icon && (
          <View
            style={[
              t.styles.avatar,
              { width: 38, height: 38, borderRadius: 12 },
            ]}
          >
            <Icon size={18} color={t.colors.forest} strokeWidth={1.7} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={t.styles.label}>{title}</Text>
          {subtitle && <Text style={t.styles.small}>{subtitle}</Text>}
        </View>
      </View>
      {end || (onPress && <ChevronRight size={17} color={t.colors.muted} />)}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        t.styles.inline,
        { paddingVertical: 4 },
        pressed && t.styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[t.styles.inline, { paddingVertical: 4 }]}>{content}</View>
  );
}
