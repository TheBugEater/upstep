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
}: {
  client: SupportClient;
  config: SupportConfiguration;
  dark?: boolean;
}) {
  const [chat, setChat] = useState<SupportConversation | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<ScrollView>(null);
  const active = useRef(true);
  const pending = useRef<{ text: string; id: string } | null>(null);
  const colors = {
    bg: dark ? "#000000" : "#ffffff",
    soft: dark ? "#191d1b" : "#f4f6f4",
    text: dark ? "#e5e7e5" : "#37413c",
    muted: dark ? "#a2aaa5" : "#69756d",
    line: dark ? "#303833" : "#dde4de",
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
            {m.id === chat.activeWidgetMessageId &&
              m.metadata?.widgets
                ?.filter((w) => w.type !== "contact_form" || chat.canEscalate)
                .map((w) => (
                  <NativeSupportWidget
                    key={w.id}
                    widget={w}
                    busy={busy}
                    color={colors}
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
                ))}
          </View>
        ))}
        {chat?.canEscalate && !chat.activeWidgetMessageId && (
          <NativeSupportWidget
            widget={{
              id: `contact:${chat.id}`,
              type: "contact_form",
              title: "Let the team follow up",
              summary: chat.escalationSummary || "",
            }}
            busy={busy}
            color={colors}
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
        )}
        {chat?.aiPending && (
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <ActivityIndicator color="#7c9386" />
            <Text style={[styles.meta, { color: colors.muted }]}>
              Thinking…
            </Text>
          </View>
        )}
      </ScrollView>
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
        <TouchableOpacity style={styles.send} onPress={() => setChat(null)}>
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
            style={[styles.send, { opacity: busy || !text.trim() ? 0.45 : 1 }]}
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
function NativeSupportWidget({
  widget,
  busy,
  color,
  name,
  email,
  verified,
  onReply,
  onContact,
  onDetails,
}: {
  widget: SupportWidget;
  busy: boolean;
  color: { soft: string; text: string; muted: string; line: string };
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
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setName] = useState(name);
  const [address, setEmail] = useState(email);
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [reference, setReference] = useState("");
  const id = useRef(supportMessageId());
  if (widget.type === "quick_replies" || widget.type === "confirmation")
    return (
      <View style={{ gap: 8, marginTop: 12 }}>
        <Text style={[styles.label, { color: color.text }]}>
          {widget.title}
        </Text>
        {widget.options.map((option) => (
          <TouchableOpacity
            key={option}
            disabled={busy}
            style={[styles.option, { borderColor: color.line }]}
            onPress={() => void onReply(option)}
          >
            <Text style={[styles.body, { color: color.text }]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  const field = (
    label: string,
    value: string,
    set: (s: string) => void,
    kind: "email-address" | "default" = "default",
    readOnly = false,
  ) => (
    <View style={{ gap: 6 }}>
      <Text style={[styles.meta, { color: color.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        editable={!readOnly && !busy}
        keyboardType={kind}
        autoCapitalize={kind === "email-address" ? "none" : "sentences"}
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
      <Text style={[styles.title, { color: color.text }]}>{widget.title}</Text>
      {widget.type === "contact_form" ? (
        <>
          <Text style={[styles.body, { color: color.muted }]}>
            {widget.summary}
          </Text>
          {!open ? (
            <TouchableOpacity
              disabled={busy}
              style={styles.send}
              onPress={() => setOpen(true)}
            >
              <Text style={styles.sendText}>Ask the team</Text>
            </TouchableOpacity>
          ) : (
            <>
              {field("Your name", fullName, setName)}
              {field(
                "Email address",
                address,
                setEmail,
                "email-address",
                verified && !!email,
              )}
              <Text style={[styles.meta, { color: color.muted }]}>
                The team will use these details to follow up.
              </Text>
              <TouchableOpacity
                disabled={busy || !fullName.trim() || !address.trim()}
                style={[
                  styles.send,
                  {
                    opacity:
                      busy || !fullName.trim() || !address.trim() ? 0.5 : 1,
                  },
                ]}
                onPress={() => void onContact(fullName, address)}
              >
                <Text style={styles.sendText}>Send to the team</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      ) : (
        <>
          {field("What is happening?", summary, setSummary)}
          {field("What have you tried? (optional)", details, setDetails)}
          {field(
            "Order or issue reference (optional)",
            reference,
            setReference,
          )}
          <TouchableOpacity
            disabled={busy || !summary.trim()}
            style={styles.send}
            onPress={() =>
              void onDetails({
                widgetId: widget.id,
                summary,
                details,
                reference,
                clientMessageId: id.current,
              })
            }
          >
            <Text style={styles.sendText}>Send details</Text>
          </TouchableOpacity>
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
  body: { fontSize: 16, lineHeight: 25 },
  meta: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 15, fontWeight: "600" },
  bubble: { padding: 14, borderRadius: 16 },
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
    backgroundColor: "#5b7168",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 16, fontWeight: "600", color: "white" },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 12, padding: 12 },
  form: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    fontSize: 16,
  },
});
