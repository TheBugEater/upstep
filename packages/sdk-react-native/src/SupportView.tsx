import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SupportClient, supportMessageId } from "@upstep/js/support";
import type {
  SupportConfiguration,
  SupportConversation,
  SupportWidget,
} from "@upstep/types";
export function SupportView({
  client,
  config,
  dark = false,
  accentColor = "#D97757",
}: {
  client: SupportClient;
  config: SupportConfiguration;
  dark?: boolean;
  accentColor?: string;
}) {
  const { height } = useWindowDimensions();
  const [chat, setChat] = useState<SupportConversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<React.ElementRef<typeof ScrollView>>(null);
  const active = useRef(true);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const colors = {
    bg: dark ? "#000000" : "#ffffff",
    soft: dark ? "#171717" : "#f5f5f5",
    text: dark ? "#e5e5e5" : "#404040",
    muted: dark ? "#a3a3a3" : "#737373",
    line: dark ? "#404040" : "#e5e5e5",
  };
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
      if (active.current) setText("");
      await refresh(c.id);
    });
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
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.heading, { borderColor: colors.line }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {config.businessName}
        </Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {chat?.state === "HUMAN"
            ? "The team is here to help"
            : "AI support for your questions"}
        </Text>
      </View>
      {chat?.ticketReference && (
        <View style={[styles.ticket, { backgroundColor: colors.soft }]}>
          <Text selectable style={[styles.label, { color: colors.text }]}>
            Ticket {chat.ticketReference}
          </Text>
          {chat.supportEmail && (
            <TouchableOpacity
              onPress={() =>
                void Linking.openURL(
                  `mailto:${chat.supportEmail}?subject=${encodeURIComponent(chat.ticketReference || "")}`,
                )
              }
            >
              <Text style={[styles.meta, { color: colors.muted }]}>
                {chat.supportEmail}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (chat) list.current?.scrollToEnd({ animated: true });
        }}
      >
        {!chat && (
          <View style={{ gap: 16, paddingVertical: 12 }}>
            <Text style={[styles.hero, { color: colors.text }]}>
              How can we help?
            </Text>
            <Text style={[styles.body, { color: colors.muted }]}>
              {config.welcomeMessage}
            </Text>
            {[
              "What can you help me with?",
              `I need help using ${config.businessName}`,
            ].map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.option, { borderColor: colors.line }]}
                onPress={() => setText(q)}
              >
                <Text style={[styles.body, { color: colors.text }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {chat?.messages.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.role === "CUSTOMER" ? "flex-end" : "stretch",
              maxWidth: m.role === "CUSTOMER" ? "94%" : "100%",
            }}
          >
            <Text
              style={[styles.meta, { color: colors.muted, marginBottom: 6 }]}
            >
              {m.role === "CUSTOMER" ? "You" : m.authorName}
            </Text>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor:
                    m.role === "SYSTEM" ? "transparent" : colors.soft,
                },
              ]}
            >
              {m.content.split(/\n\s*\n/).map((paragraph, i) => (
                <Text
                  key={i}
                  selectable
                  style={[styles.body, { color: colors.text, marginBottom: 8 }]}
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
                    style={[styles.meta, { color: colors.muted, marginTop: 8 }]}
                  >
                    ↗ {c.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {chat?.aiPending && (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color={accentColor} />
            <Text style={[styles.meta, { color: colors.muted }]}>
              Thinking…
            </Text>
          </View>
        )}
      </ScrollView>
      {chat && widgets.length > 0 && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{
            maxHeight: height * 0.38,
            flexGrow: 0,
            marginHorizontal: 12,
          }}
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
          style={[styles.send, { backgroundColor: accentColor }]}
          onPress={() => setChat(null)}
        >
          <Text style={styles.sendText}>Start a new conversation</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.composer, { borderColor: colors.line }]}>
          <TextInput
            accessibilityLabel="Your message"
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Type your message…"
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
                backgroundColor: accentColor,
                opacity: busy || !text.trim() ? 0.45 : 1,
              },
            ]}
          >
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
      {config.showBranding !== false && (
        <Text
          style={[
            styles.meta,
            { color: colors.muted, textAlign: "center", padding: 10 },
          ]}
        >
          Powered by UpStep
        </Text>
      )}
    </View>
  );
}
type ActionProps = {
  online: boolean;
  busy: boolean;
  color: { soft: string; text: string; muted: string; line: string };
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
function NativeSupportActions({
  widgets,
  ...props
}: ActionProps & { widgets: SupportWidget[] }) {
  const [selected, setSelected] = useState(
    widgets.find((w) => w.type === "quick_replies")?.id || widgets[0]?.id,
  );
  const widget = widgets.find((w) => w.id === selected) || widgets[0];
  return (
    <View style={{ gap: 8, paddingBottom: 4 }}>
      {widgets.length > 1 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {widgets.map((w) => (
            <TouchableOpacity
              key={w.id}
              onPress={() => setSelected(w.id)}
              style={[
                styles.option,
                { borderColor: props.color.line, padding: 8 },
              ]}
            >
              <Text style={{ fontSize: 13, color: props.color.text }}>
                {w.type === "quick_replies" ? "Quick replies" : "Issue details"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {widget && (
        <NativeSupportWidget key={widget.id} {...props} widget={widget} />
      )}
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
  onReply,
  onContact,
  onDetails,
}: ActionProps & { widget: SupportWidget }) {
  const [step, setStep] = useState(0),
    [issueOpen, setIssueOpen] = useState(false),
    [more, setMore] = useState(false);
  const [fullName, setName] = useState(name),
    [address, setEmail] = useState(email),
    [summary, setSummary] = useState(""),
    [details, setDetails] = useState(""),
    [reference, setReference] = useState("");
  const id = useRef(supportMessageId());
  const action = (title: string, press: () => void, disabled = false) => (
    <TouchableOpacity
      disabled={disabled || busy}
      style={[
        styles.send,
        { backgroundColor: accentColor, opacity: disabled || busy ? 0.5 : 1 },
      ]}
      onPress={press}
    >
      <Text style={styles.sendText}>{title}</Text>
    </TouchableOpacity>
  );
  if (widget.type === "quick_replies" || widget.type === "confirmation")
    return (
      <View style={{ gap: 8 }}>
        <Text style={[styles.meta, { color: color.muted }]}>
          {widget.title}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {widget.options.map((option) => (
            <TouchableOpacity
              key={option}
              disabled={busy}
              style={[styles.option, { borderColor: color.line }]}
              onPress={() => void onReply(option)}
            >
              <Text style={{ fontSize: 13, color: color.text }}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
      <Text style={[styles.meta, { color: color.muted }]}>{label}</Text>
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
  return (
    <View
      style={[
        styles.form,
        { backgroundColor: color.soft, borderColor: color.line },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text style={[styles.label, { color: color.text }]}>
          {widget.title}
        </Text>
        {widget.type === "contact_form" && step > 0 && (
          <Text style={[styles.meta, { color: color.muted }]}>{step} of 2</Text>
        )}
      </View>
      {widget.type === "contact_form" ? (
        step === 0 ? (
          <>
            <Text
              numberOfLines={2}
              style={[styles.meta, { color: color.muted }]}
            >
              {widget.summary}
            </Text>
            {action("Ask the team", () => setStep(1))}
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
                style={styles.option}
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
                    else void onContact(fullName, address);
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
                styles.meta,
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
              }),
            !summary.trim(),
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: "600" },
  hero: { fontSize: 28, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 23 },
  meta: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 15, fontWeight: "600" },
  bubble: { padding: 12, borderRadius: 16 },
  ticket: { padding: 12, gap: 4 },
  composer: {
    margin: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 44,
    maxHeight: 120,
    padding: 8,
  },
  send: {
    minHeight: 44,

    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 14, fontWeight: "600", color: "white" },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 12, padding: 12 },
  form: {
    marginTop: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
  },
});
