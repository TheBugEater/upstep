import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SupportClient, supportMessageId } from "@upstep/js/support";
import type {
  SupportConfiguration,
  SupportConversation,
  SupportWidget,
} from "@upstep/types";
import { useSupportUnread } from "./useSupportUnread";
import type { UpstepColorOverrides } from "@upstep/types";
import { mixColors, withAlpha } from "@upstep/js/theme";
import {
  RadiusContext,
  clampRadius,
  supportBaseColors,
  useScaledStyles,
} from "./theme";

type Colors = {
  bg: string;
  soft: string;
  text: string;
  muted: string;
  line: string;
  ink: string;
  onInk: string;
  /** Accent tint for tappable surfaces: replies and follow-up cards. */
  tint: string;
  tintLine: string;
  accentInk: string;
  /** Text on accent fills. */
  accentText: string;
};

const alpha = withAlpha;
function mix(color: string, toward: string, amount: number) {
  return mixColors(color, toward, amount) ?? color;
}
function clock(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
const isChoice = (w: SupportWidget) =>
  w.type === "quick_replies" || w.type === "confirmation";

export function SupportView({
  radius,
  ...props
}: SupportViewProps & {
  /** Base corner radius in px. Defaults to the provider's, or 12 outside one. */
  radius?: number;
}) {
  // Used on its own, the chat can still take a radius; inside the provider it inherits one.
  if (radius === undefined) return <SupportViewBody {...props} />;
  return (
    <RadiusContext.Provider value={clampRadius(radius)}>
      <SupportViewBody {...props} />
    </RadiusContext.Provider>
  );
}

interface SupportViewProps {
  client: SupportClient;
  config: SupportConfiguration;
  dark?: boolean;
  accentColor?: string;
  /** Panel color overrides, same shape as `UpstepConfig.colors`. */
  colors?: UpstepColorOverrides | undefined;
}

function SupportViewBody({
  client,
  config,
  dark = false,
  accentColor = "#D97757",
  colors: overrides,
}: SupportViewProps) {
  const styles = useScaledStyles(baseStyles);
  const { height } = useWindowDimensions();
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [config.logoUrl]);
  const [chat, setChat] = useState<SupportConversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [sound, setSound] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const list = useRef<React.ElementRef<typeof ScrollView>>(null);
  const active = useRef(true);
  const soundOn = useRef(true);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const { inkTarget, ...base } = supportBaseColors(
    dark,
    accentColor,
    overrides,
  );
  const colors: Colors = {
    ...base,
    tint: alpha(accentColor, dark ? 0.18 : 0.12) ?? base.soft,
    tintLine: alpha(accentColor, 0.55) ?? accentColor,
    accentInk: mix(accentColor, inkTarget, dark ? 0.45 : 0.4),
  };
  useEffect(() => {
    void client.soundEnabled().then((value) => {
      soundOn.current = value;
      if (active.current) setSound(value);
    });
    const subscription = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    return () => subscription.remove();
  }, [client]);
  const { count, firstUnread, clearDivider } = useSupportUnread({
    client,
    chat,
    viewing: atBottom && appActive,
    onIncoming: (latest, wasViewing) => {
      // AI replies the customer is watching stay quiet; team replies always buzz.
      if (wasViewing && latest.role !== "AGENT") return;
      if (soundOn.current) Vibration.vibrate(30);
    },
  });
  async function refresh(id: string) {
    const next = await client.conversation(id);
    if (active.current) setChat(next);
  }
  useEffect(() => {
    active.current = true;
    void client
      .conversations()
      .then((items) => {
        if (items[0]) return refresh(items[0].id);
      })
      .catch((e) => setError(e.message));
    return () => {
      active.current = false;
    };
  }, [client]);
  useEffect(() => {
    if (!chat) return;
    const id = chat.id;
    const timer = setInterval(() => {
      if (AppState.currentState === "active")
        void refresh(id).catch((e) => {
          if (active.current) setError(e.message);
        });
    }, 2500);
    return () => clearInterval(timer);
  }, [chat?.id, client]);
  async function perform(fn: () => Promise<void>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function send(value = text) {
    return perform(async () => {
      if (!value.trim()) return;
      const c =
        !chat || chat.state === "RESOLVED"
          ? await client.startConversation()
          : chat;
      if (!pending.current || pending.current.text !== value)
        pending.current = { text: value, id: supportMessageId() };
      await client.send(c.id, value, pending.current.id);
      pending.current = null;
      clearDivider();
      if (active.current) setText("");
      await refresh(c.id);
    });
  }
  function toggleSound() {
    const next = !sound;
    setSound(next);
    soundOn.current = next;
    void client.setSoundEnabled(next);
    if (next) Vibration.vibrate(30);
  }
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    setAtBottom(
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 48,
    );
  }
  const widgets: SupportWidget[] = chat?.activeWidgetMessageId
    ? (
        chat.messages.find((m) => m.id === chat.activeWidgetMessageId)?.metadata
          ?.widgets || []
      ).filter((w) => w.type !== "contact_form" || chat.canEscalate)
    : chat?.canEscalate
      ? [
          {
            id: `contact:${chat.id}`,
            type: "contact_form",
            title: "Let the team follow up",
            summary: chat.escalationSummary || "",
          },
        ]
      : [];
  const business = config.businessName;
  const isHuman = chat?.state === "HUMAN";
  const subtitle = isHuman
    ? `${chat?.messages.filter((m) => m.role === "AGENT").at(-1)?.authorName || "The team"} is here to help`
    : chat?.state === "WAITING"
      ? "Your message is with the team"
      : chat?.state === "RESOLVED"
        ? "Conversation resolved"
        : config.online.length
          ? "AI and our team are here for you"
          : "AI is here. The team can join when needed.";
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.heading, { borderColor: colors.line }]}>
        <View style={styles.headingRow}>
          <View style={styles.avatarWrap}>
            {config.logoUrl && !logoFailed ? (
              <Image
                accessibilityLabel={`${business} logo`}
                source={{ uri: config.logoUrl }}
                resizeMode="contain"
                onError={() => setLogoFailed(true)}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.ink }]}>
                <Text style={{ color: colors.onInk, fontWeight: "700" }}>
                  {business.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.dot,
                {
                  borderColor: colors.bg,
                  backgroundColor:
                    config.online.length || isHuman ? "#22c55e" : accentColor,
                },
              ]}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={[styles.title, { color: colors.text }]}
            >
              {business}
            </Text>
            <View style={styles.statusRow}>
              <Text
                numberOfLines={1}
                style={[styles.status, { color: colors.muted, flexShrink: 1 }]}
              >
                {subtitle}
              </Text>
              {chat?.ticketReference && (
                <Text
                  selectable
                  style={[
                    styles.ticket,
                    {
                      color: colors.text,
                      backgroundColor: colors.soft,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  {chat.ticketReference}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Conversation options"
            accessibilityState={{ expanded: showInfo }}
            onPress={() => setShowInfo(!showInfo)}
            style={styles.more}
          >
            <Text
              style={{ color: colors.muted, fontSize: 18, letterSpacing: 1 }}
            >
              •••
            </Text>
          </TouchableOpacity>
        </View>
        {showInfo && (
          <View
            style={[
              styles.info,
              { backgroundColor: colors.soft, borderColor: colors.line },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: sound }}
              onPress={toggleSound}
              style={styles.infoRow}
            >
              <Text style={[styles.status, { color: colors.text }]}>
                New message alerts
              </Text>
              <Text
                style={[
                  styles.status,
                  { color: colors.accentInk, fontWeight: "700" },
                ]}
              >
                {sound ? "On" : "Off"}
              </Text>
            </TouchableOpacity>
            {chat?.supportEmail && (
              <TouchableOpacity
                onPress={() =>
                  void Linking.openURL(
                    `mailto:${chat.supportEmail}${chat.ticketReference ? `?subject=${encodeURIComponent(`Support ${chat.ticketReference}`)}` : ""}`,
                  )
                }
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.status,
                    { color: colors.text, textDecorationLine: "underline" },
                  ]}
                >
                  Email {chat.supportEmail}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.status, { color: colors.muted }]}>
              {config.showBranding !== false
                ? "Powered by UpStep"
                : `${business} support`}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={list}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={onScroll}
          onContentSizeChange={() => {
            if (chat && (atBottom || chat.messages.at(-1)?.role === "CUSTOMER"))
              list.current?.scrollToEnd({ animated: true });
          }}
        >
          {!chat && (
            <View style={{ gap: 14, paddingVertical: 12 }}>
              <Text style={[styles.hero, { color: colors.text }]}>
                How can we help?
              </Text>
              <Text style={[styles.body, { color: colors.muted }]}>
                {config.welcomeMessage}
              </Text>
              {[
                "What can you help me with?",
                `I need help using ${business}`,
              ].map((q) => (
                <TouchableOpacity
                  key={q}
                  accessibilityRole="button"
                  style={[styles.option, { borderColor: colors.line }]}
                  onPress={() => setText(q)}
                >
                  <Text style={[styles.body, { color: colors.text }]}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {chat?.messages.map((m, i) => {
            const customer = m.role === "CUSTOMER";
            const previous = chat.messages[i - 1];
            const next = chat.messages[i + 1];
            const divider = m.id === firstUnread && (
              <View style={styles.newRow} accessibilityRole="text">
                <View
                  style={[styles.rule, { backgroundColor: colors.tintLine }]}
                />
                <Text style={[styles.newText, { color: colors.accentInk }]}>
                  NEW
                </Text>
                <View
                  style={[styles.rule, { backgroundColor: colors.tintLine }]}
                />
              </View>
            );
            if (m.role === "SYSTEM")
              return (
                <View key={m.id}>
                  {divider}
                  <Text
                    style={[
                      styles.status,
                      {
                        color: colors.muted,
                        textAlign: "center",
                        marginVertical: 10,
                      },
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
              );
            const firstOfRun =
              !previous ||
              previous.role === "SYSTEM" ||
              previous.role !== m.role ||
              previous.authorName !== m.authorName;
            const lastOfRun =
              !next ||
              next.role === "SYSTEM" ||
              next.role !== m.role ||
              next.authorName !== m.authorName;
            return (
              <View key={m.id}>
                {divider}
                <View
                  style={{ alignItems: customer ? "flex-end" : "flex-start" }}
                >
                  {firstOfRun && !customer && (
                    <View style={styles.whoRow}>
                      <Text style={[styles.who, { color: colors.muted }]}>
                        {m.role === "ASSISTANT"
                          ? `${business} AI`
                          : m.authorName}
                      </Text>
                      <Text
                        style={[
                          styles.tag,
                          m.role === "AGENT"
                            ? { color: "#15803d", backgroundColor: "#dcfce7" }
                            : {
                                color: colors.muted,
                                backgroundColor: colors.soft,
                              },
                        ]}
                      >
                        {m.role === "ASSISTANT" ? "AI" : "TEAM"}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      customer
                        ? {
                            backgroundColor: colors.ink,
                            borderBottomRightRadius: 5,
                            marginTop: firstOfRun ? 10 : 0,
                          }
                        : {
                            backgroundColor: colors.soft,
                            borderTopLeftRadius: 5,
                          },
                    ]}
                  >
                    {m.content.split(/\n\s*\n/).map((paragraph, n, all) => (
                      <Text
                        key={n}
                        selectable
                        style={[
                          styles.body,
                          {
                            color: customer ? colors.onInk : colors.text,
                            marginBottom: n === all.length - 1 ? 0 : 8,
                          },
                        ]}
                      >
                        {paragraph}
                      </Text>
                    ))}
                    {m.metadata?.citations?.map((c) => (
                      <TouchableOpacity
                        key={c.url}
                        onPress={() => void Linking.openURL(c.url)}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.status,
                            { color: colors.muted, marginTop: 8 },
                          ]}
                        >
                          ↗ {c.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {lastOfRun && !!clock(m.createdAt) && (
                    <Text style={[styles.stamp, { color: colors.muted }]}>
                      {clock(m.createdAt)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          {chat?.aiPending && (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.typing, { backgroundColor: colors.soft }]}
            >
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={[styles.status, { color: colors.muted }]}>
                {business} AI is typing
              </Text>
            </View>
          )}
        </ScrollView>
        {!atBottom && count > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${count} new messages, jump to latest`}
            onPress={() => list.current?.scrollToEnd({ animated: true })}
            style={[styles.jump, { backgroundColor: colors.ink }]}
          >
            <Text
              style={{ color: colors.onInk, fontSize: 12, fontWeight: "700" }}
            >
              {count} new ↓
            </Text>
          </Pressable>
        )}
      </View>
      {chat && widgets.length > 0 && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: height * 0.42, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 6 }}
        >
          <NativeSupportActions
            key={chat.activeWidgetMessageId || chat.id}
            widgets={widgets}
            online={config.online.length > 0}
            busy={busy}
            color={colors}
            accentColor={accentColor}
            name={chat.customer.name || ""}
            email={chat.customer.email || ""}
            verified={chat.customer.verified}
            onReply={send}
            onContact={(name, email) =>
              perform(async () => {
                await client.handoff(chat.id, name, email);
                await refresh(chat.id);
              })
            }
            onDetails={(values) =>
              perform(async () => {
                await client.details(chat.id, values);
                await refresh(chat.id);
              })
            }
          />
        </ScrollView>
      )}
      {error.length > 0 && (
        <Text
          accessibilityRole="alert"
          style={{
            color: dark ? "#e8aaa4" : "#a44e45",
            paddingHorizontal: 16,
            paddingBottom: 8,
            fontSize: 14,
          }}
        >
          {error}
        </Text>
      )}
      {chat?.state === "RESOLVED" ? (
        <TouchableOpacity
          style={[styles.resolved, { backgroundColor: accentColor }]}
          onPress={() => setChat(null)}
        >
          <Text style={[styles.sendText, { color: colors.accentText }]}>
            Start a new conversation
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.composer, { borderColor: colors.line }]}>
          <TextInput
            accessibilityLabel="Your message"
            multiline
            value={text}
            onChangeText={setText}
            placeholder={`Message ${business}…`}
            placeholderTextColor={colors.muted}
            maxLength={4000}
            style={[styles.input, { color: colors.text }]}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={busy || !text.trim()}
            onPress={() => void send()}
            style={[
              styles.send,
              {
                backgroundColor: text.trim() ? accentColor : colors.soft,
              },
            ]}
          >
            <Text
              style={[
                styles.sendText,
                { color: text.trim() ? colors.accentText : colors.muted },
              ]}
            >
              ↑
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
type ActionProps = {
  online: boolean;
  busy: boolean;
  color: Colors;
  accentColor: string;
  name: string;
  email: string;
  verified: boolean;
  onReply: (text: string) => Promise<boolean>;
  onContact: (name: string, email: string) => Promise<boolean>;
  onDetails: (data: {
    widgetId: string;
    summary: string;
    details: string;
    reference: string;
    clientMessageId: string;
  }) => Promise<boolean>;
};
/** Replies get their own tray. Follow-up forms open from quiet text actions beside it. */
function NativeSupportActions({
  widgets,
  ...props
}: ActionProps & { widgets: SupportWidget[] }) {
  const styles = useScaledStyles(baseStyles);
  const choice = widgets.find(isChoice);
  const others = widgets.filter((w) => !isChoice(w));
  const [opened, setOpened] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const expanded = others.find((w) => w.id === opened);
  const direct = choice ? [] : others;
  const { color } = props;
  return (
    <View style={{ gap: 10 }}>
      {choice && !answered && "options" in choice && (
        <View
          style={[
            styles.tray,
            { borderColor: color.line, backgroundColor: color.bg },
          ]}
        >
          <View style={styles.trayHead}>
            <Text
              numberOfLines={1}
              style={[styles.trayLabel, { color: color.muted, flex: 1 }]}
            >
              {(choice.title || "Quick replies").toUpperCase()}
            </Text>
            {others.map((w) => (
              <TouchableOpacity
                key={w.id}
                disabled={props.busy}
                accessibilityRole="button"
                accessibilityState={{ expanded: opened === w.id }}
                onPress={() => setOpened(opened === w.id ? null : w.id)}
                style={styles.textAction}
              >
                <Text style={[styles.textActionLabel, { color: color.muted }]}>
                  {w.type === "contact_form"
                    ? "Talk to a person"
                    : "Add details"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingRight: 24 }}
          >
            {choice.options.map((option) => (
              <TouchableOpacity
                key={option}
                accessibilityRole="button"
                disabled={props.busy}
                style={[
                  styles.chip,
                  {
                    backgroundColor: color.tint,
                    borderColor: color.tintLine,
                    opacity: props.busy ? 0.5 : 1,
                  },
                ]}
                onPress={() =>
                  void props.onReply(option).then((ok) => {
                    if (ok) setAnswered(true);
                  })
                }
              >
                <Text style={[styles.chipIcon, { color: color.accentInk }]}>
                  {"↩︎"}
                </Text>
                <Text style={[styles.chipText, { color: color.accentInk }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {expanded && !direct.length && (
        <NativeSupportWidget
          key={expanded.id}
          {...props}
          widget={expanded}
          startOpen
        />
      )}
      {direct.map((w) => (
        <NativeSupportWidget key={w.id} {...props} widget={w} />
      ))}
    </View>
  );
}
function NativeSupportWidget({
  widget,
  busy,
  color,
  accentColor,
  name,
  email,
  verified,
  online,
  startOpen = false,
  onContact,
  onDetails,
}: ActionProps & { widget: SupportWidget; startOpen?: boolean }) {
  const styles = useScaledStyles(baseStyles);
  const [step, setStep] = useState(startOpen ? 1 : 0),
    [issueOpen, setIssueOpen] = useState(startOpen),
    [more, setMore] = useState(false),
    [done, setDone] = useState(false);
  const [fullName, setName] = useState(name),
    [address, setEmail] = useState(email),
    [summary, setSummary] = useState(""),
    [details, setDetails] = useState(""),
    [reference, setReference] = useState("");
  const id = useRef(supportMessageId());
  if (done)
    return (
      <Text
        accessibilityRole="alert"
        style={[styles.status, { color: color.muted, paddingVertical: 8 }]}
      >
        ✓{" "}
        {widget.type === "contact_form"
          ? "Your request is with the team."
          : "Details sent."}
      </Text>
    );
  if (isChoice(widget)) return null;
  const action = (title: string, press: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled || busy}
      style={[
        styles.send,
        styles.wide,
        { backgroundColor: accentColor, opacity: disabled || busy ? 0.5 : 1 },
      ]}
      onPress={press}
    >
      <Text style={[styles.sendText, { color: color.accentText }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    emailField = false,
    readOnly = false,
    maxLength = 160,
  ) => (
    <View style={{ gap: 4 }}>
      <Text style={[styles.status, { color: color.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        editable={!busy && !readOnly}
        maxLength={maxLength}
        keyboardType={emailField ? "email-address" : "default"}
        autoCapitalize={emailField ? "none" : "sentences"}
        style={[
          styles.formInput,
          { color: color.text, borderColor: color.line },
        ]}
      />
    </View>
  );
  const title =
    widget.type === "contact_form" && online
      ? "Connect with the team"
      : widget.title;
  return (
    <View
      style={[
        styles.card,
        { borderColor: color.line, backgroundColor: color.bg },
      ]}
    >
      <View
        style={[
          styles.cardHead,
          { backgroundColor: color.tint, borderColor: color.tintLine },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.cardTitle, { color: color.accentInk, flex: 1 }]}
        >
          {title}
        </Text>
        {widget.type === "contact_form" && step > 0 && (
          <Text style={[styles.status, { color: color.accentInk }]}>
            {step} of 2
          </Text>
        )}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        {widget.type === "contact_form" ? (
          step === 0 ? (
            <>
              <Text
                numberOfLines={2}
                style={[styles.status, { color: color.muted }]}
              >
                {widget.summary}
              </Text>
              {action("Talk to a person", () => setStep(1))}
            </>
          ) : (
            <>
              {step === 1
                ? field("Your name", fullName, setName, false, false, 100)
                : field(
                    "Email for support follow-up",
                    address,
                    setEmail,
                    true,
                    verified && !!email,
                    254,
                  )}
              <View
                style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
              >
                <TouchableOpacity
                  style={[
                    styles.option,
                    { borderColor: color.line, minHeight: 44 },
                  ]}
                  disabled={busy}
                  onPress={() => setStep(step - 1)}
                >
                  <Text style={{ color: color.text, fontSize: 13 }}>Back</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  {action(
                    step === 1
                      ? "Continue"
                      : online
                        ? "Request transfer"
                        : "Send to the team",
                    () => {
                      if (step === 1) setStep(2);
                      else
                        void onContact(fullName, address).then((ok) => {
                          if (ok) setDone(true);
                        });
                    },
                    !fullName.trim() || (step === 2 && !address.trim()),
                  )}
                </View>
              </View>
            </>
          )
        ) : !issueOpen ? (
          action("Add issue details", () => setIssueOpen(true))
        ) : (
          <>
            {field("What is happening?", summary, setSummary)}
            <TouchableOpacity onPress={() => setMore(!more)}>
              <Text
                style={[
                  styles.status,
                  { color: color.muted, textDecorationLine: "underline" },
                ]}
              >
                {more
                  ? "Hide optional details"
                  : "Add notes or a reference (optional)"}
              </Text>
            </TouchableOpacity>
            {more && (
              <>
                {field(
                  "What have you tried?",
                  details,
                  setDetails,
                  false,
                  false,
                  2000,
                )}
                {field(
                  "Order or issue reference",
                  reference,
                  setReference,
                  false,
                  false,
                  100,
                )}
              </>
            )}
            {action(
              "Send details",
              () =>
                void onDetails({
                  widgetId: widget.id,
                  summary,
                  details,
                  reference,
                  clientMessageId: id.current,
                }).then((ok) => {
                  if (ok) setDone(true);
                }),
              !summary.trim(),
            )}
          </>
        )}
      </View>
    </View>
  );
}
const baseStyles = StyleSheet.create({
  root: { flex: 1 },
  heading: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarWrap: { width: 36, height: 36 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  title: { fontSize: 15, fontWeight: "600" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  status: { fontSize: 13, lineHeight: 18 },
  ticket: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: undefined,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  more: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  infoRow: {
    minHeight: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hero: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22 },
  bubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  whoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
    marginLeft: 2,
  },
  who: { fontSize: 12, fontWeight: "600" },
  tag: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    paddingHorizontal: 5,
    borderRadius: 4,
    overflow: "hidden",
  },
  stamp: { fontSize: 11, marginTop: 3, marginHorizontal: 2 },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  newText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderTopLeftRadius: 5,
  },
  jump: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  tray: { borderWidth: 1, borderRadius: 16, padding: 10, gap: 8 },
  trayHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  trayLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7 },
  textAction: { minHeight: 32, justifyContent: "center", paddingHorizontal: 4 },
  textActionLabel: { fontSize: 12, fontWeight: "600" },
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipIcon: { fontSize: 15, fontWeight: "700" },
  chipText: { fontSize: 14, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  cardTitle: { fontSize: 12, fontWeight: "700" },
  composer: {
    marginHorizontal: 10,
    marginBottom: 10,
    marginTop: 4,
    borderWidth: 1.5,
    borderRadius: 26,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: 9,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  wide: { width: "100%", borderRadius: 12, height: undefined, minHeight: 44 },
  resolved: {
    margin: 12,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 15, fontWeight: "700", color: "white" },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
  },
});
