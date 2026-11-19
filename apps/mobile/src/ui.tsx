import React from "react";
import {
  Pressable,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react-native";
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
  style?: StyleProp<ViewStyle>;
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
          size={18}
          strokeWidth={2}
          color={primary ? t.colors.onPrimary : t.colors.text}
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
  filled = false,
}: {
  label: string;
  icon: LucideIcon;
  onPress(): void;
  t: Theme;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        filled ? t.styles.roundButton : t.styles.iconButton,
        pressed && t.styles.pressed,
        disabled && t.styles.disabled,
      ]}
    >
      <Icon size={filled ? 19 : 23} strokeWidth={1.9} color={t.colors.text} />
    </Pressable>
  );
}

export function BrandMark({ t, size = 30 }: { t: Theme; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: t.dark ? t.colors.card : "#0a0a0a",
        borderWidth: t.dark ? 1 : 0,
        borderColor: t.colors.line,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ArrowUpRight size={size * 0.62} strokeWidth={2.8} color="#ff7a50" />
    </View>
  );
}

export function Brand({ t }: { t: Theme }) {
  return (
    <View
      style={[t.styles.inline, { gap: 8 }]}
      accessibilityLabel="Upstep support"
    >
      <BrandMark t={t} />
      <Text style={t.styles.brand}>upstep</Text>
    </View>
  );
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "V";

export function Avatar({
  name,
  t,
  size = 40,
  round = false,
}: {
  name: string;
  t: Theme;
  size?: number;
  round?: boolean;
}) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const [bg, fg] = t.colors.tints[Math.abs(hash) % t.colors.tints.length] ?? [
    t.colors.soft,
    t.colors.body,
  ];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : size * 0.3,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ color: fg, fontSize: size * 0.36, fontWeight: "600" }}
        maxFontSizeMultiplier={1.2}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function Chip({
  title,
  t,
  tone = "neutral",
  icon: Icon,
}: {
  title: string;
  t: Theme;
  tone?: "neutral" | "clay" | "note";
  icon?: LucideIcon;
}) {
  const [bg, fg] =
    tone === "clay"
      ? [t.colors.clayTint, t.colors.clayText]
      : tone === "note"
        ? [t.colors.note, t.colors.noteText]
        : [t.colors.soft, t.colors.body];
  return (
    <View style={[t.styles.chip, { backgroundColor: bg }]}>
      {Icon && <Icon size={12} color={fg} strokeWidth={2.2} />}
      <Text style={[t.styles.chipText, { color: fg }]}>{title}</Text>
    </View>
  );
}

export function SectionLabel({
  title,
  t,
  color,
}: {
  title: string;
  t: Theme;
  color?: string;
}) {
  return (
    <View style={[t.styles.inline, { gap: 8 }]}>
      {color && <View style={[t.styles.dot, { backgroundColor: color }]} />}
      <Text style={t.styles.sectionLabel}>{title}</Text>
    </View>
  );
}

export function Toggle({
  value,
  onValueChange,
  label,
  disabled,
  t,
}: {
  value: boolean;
  onValueChange(value: boolean): void;
  label: string;
  disabled?: boolean;
  t: Theme;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      trackColor={{ true: t.colors.primary, false: t.colors.line }}
      thumbColor={t.dark && value ? "#000000" : "#ffffff"}
      ios_backgroundColor={t.colors.line}
    />
  );
}

/** A believable lock-screen alert, used as onboarding art. */
export function NotificationArt({ t }: { t: Theme }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 172 }}
    >
      <View
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: 0,
          height: 72,
          borderRadius: 20,
          backgroundColor: t.colors.surface,
          borderWidth: t.dark ? 1 : 0,
          borderColor: t.colors.hairline,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          top: 14,
          height: 76,
          borderRadius: 20,
          backgroundColor: t.colors.soft,
        }}
      />
      <View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 30,
            borderRadius: 20,
            backgroundColor: t.colors.card,
            borderWidth: 1,
            borderColor: t.colors.line,
            padding: 14,
            flexDirection: "row",
            gap: 12,
          },
          t.styles.shadow,
        ]}
      >
        <BrandMark t={t} size={38} />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={t.styles.row}>
            <Text style={[t.styles.label, { fontSize: 14 }]}>
              A customer needs you
            </Text>
            <Text style={[t.styles.small, { fontSize: 12 }]}>now</Text>
          </View>
          <Text style={[t.styles.text, { fontSize: 14, lineHeight: 19 }]}>
            They asked for a person after talking with AI.
          </Text>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          right: 16,
          top: 128,
          flexDirection: "row",
          gap: 6,
        }}
      >
        <View
          style={{
            height: 30,
            paddingHorizontal: 12,
            borderRadius: 15,
            backgroundColor: t.colors.primary,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: t.colors.onPrimary,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Take over
          </Text>
        </View>
        <View
          style={{
            height: 30,
            paddingHorizontal: 12,
            borderRadius: 15,
            backgroundColor: t.colors.soft,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: t.colors.text, fontSize: 12 }}>Reply</Text>
        </View>
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
  disabled,
  destructive,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  t: Theme;
  end?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <>
      {Icon && (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: t.colors.soft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            size={18}
            color={destructive ? t.colors.error : t.colors.text}
            strokeWidth={1.9}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            t.styles.label,
            { fontWeight: "500" },
            destructive && { color: t.colors.error },
          ]}
        >
          {title}
        </Text>
        {subtitle && <Text style={t.styles.small}>{subtitle}</Text>}
      </View>
      {end || (onPress && <ChevronRight size={18} color={t.colors.faint} />)}
    </>
  );
  const style = [
    t.styles.inline,
    { gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed && { backgroundColor: t.colors.surface },
        disabled && t.styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

/** "now", "14m", "3h", "2d", then a short date. */
export function since(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / 1440)}d`;
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}
