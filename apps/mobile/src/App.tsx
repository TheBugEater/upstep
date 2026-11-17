import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Crypto from "expo-crypto";
import { api, restoreClient, changeServerUrl } from "./client";
import { signIn } from "./auth";
import {
  notificationTarget,
  registerNotifications,
  refreshNotificationRegistration,
  setActiveConversation,
} from "./notifications";
import {
  ApiError,
  conversationPath,
  projectPath,
  type Me,
  type Conversation,
  type Inbox,
  type Preferences,
  type ProjectDetails,
  type Assistance,
} from "./api";
import { theme, type Theme } from "./theme";

type Target = { projectId: string; conversationId: string };
type Draft = {
  text: string;
  note: boolean;
  pending: { id: string; text: string; note: boolean } | null;
};
const describe = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "Could not complete the request. Please try again.";

function Button({
  title,
  onPress,
  primary = false,
  disabled = false,
  t,
}: {
  title: string;
  onPress(): void;
  primary?: boolean;
  disabled?: boolean;
  t: Theme;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        t.styles.button,
        primary && t.styles.primary,
        disabled && t.styles.disabled,
      ]}
    >
      <Text style={[t.styles.buttonText, primary && t.styles.primaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const t = theme(useColorScheme() === "dark");
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverUrl, setServerUrl] = useState(api.baseUrl);
  const [serverInput, setServerInput] = useState(api.baseUrl);
  const [showServer, setShowServer] = useState(false);
  const [serverError, setServerError] = useState("");
  const [active, setActive] = useState(AppState.currentState === "active");
  const pendingTarget = useRef<Target | null>(null);
  const handledNotification = useRef("");
  const drafts = useRef<Record<string, Draft>>({});

  const openServer = () => {
    setServerInput(api.baseUrl);
    setServerError("");
    setShowServer(true);
  };
  const saveServer = async (forgetPrevious = false) => {
    setBusy(true);
    setServerError("");
    try {
      const origin = await changeServerUrl(serverInput, forgetPrevious);
      pendingTarget.current = null;
      handledNotification.current = "";
      setServerUrl(origin);
      setShowServer(false);
      setSettings(false);
      setError("");
    } catch (e) {
      setServerError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const loadMe = useCallback(async () => {
    const value = await api.request<Me>("/api/mobile/me");
    setMe(value);
    setProjectId((current) =>
      value.projects.some((p) => p.id === current)
        ? current
        : value.projects[0]?.id || null,
    );
    return value;
  }, []);
  useEffect(() => {
    api.onSignedOut = () => {
      setMe(null);
      setTarget(null);
      setProjectId(null);
      drafts.current = {};
    };
    void (async () => {
      try {
        if (await restoreClient()) await loadMe();
      } catch (e) {
        setError(describe(e));
      } finally {
        setServerUrl(api.baseUrl);
        setReady(true);
      }
    })();
    return () => {
      api.onSignedOut = undefined;
    };
  }, [loadMe]);
  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    const accept = (response: Notifications.NotificationResponse | null) => {
      const item = notificationTarget(response);
      const identifier = response?.notification.request.identifier || "";
      if (item && identifier !== handledNotification.current) {
        handledNotification.current = identifier;
        pendingTarget.current = item;
        setTarget(item);
        setSettings(false);
      }
    };
    const notifications =
      Notifications.addNotificationResponseReceivedListener(accept);
    void Notifications.getLastNotificationResponseAsync()
      .then(accept)
      .catch(() => {});
    return () => {
      subscription.remove();
      notifications.remove();
    };
  }, [ready]);
  useEffect(() => {
    if (!me || !target) return;
    if (!me.projects.some((p) => p.id === target.projectId)) {
      setError("This conversation is in a project you can no longer access.");
      setTarget(null);
      return;
    }
    setProjectId(target.projectId);
    pendingTarget.current = null;
  }, [me, target]);
  useEffect(() => {
    if (!me) return;
    void refreshNotificationRegistration().catch(() => {});
    const listener = Notifications.addPushTokenListener(() => {
      void refreshNotificationRegistration().catch(() => {});
    });
    return () => listener.remove();
  }, [me]);
  useEffect(() => {
    if (!me) return;
    const heartbeat = () => {
      const conversation = active && !settings ? target : null;
      setActiveConversation(conversation?.conversationId || null);
      void api
        .request("/api/mobile/device", "POST", {
          projectId: conversation?.projectId || null,
          conversationId: conversation?.conversationId || null,
        })
        .catch(() => {});
    };
    heartbeat();
    const timer = setInterval(heartbeat, 25_000);
    return () => {
      clearInterval(timer);
      setActiveConversation(null);
    };
  }, [me, target, active, settings]);
  const login = async () => {
    setBusy(true);
    setError("");
    try {
      if (await signIn()) {
        await loadMe();
        if (pendingTarget.current) setTarget(pendingTarget.current);
      }
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };
  const project = me?.projects.find((p) => p.id === projectId);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={t.styles.screen}>
        <StatusBar style="auto" />
        <View style={t.styles.page}>
          {!ready ? (
            <View style={t.styles.center}>
              <ActivityIndicator color={t.colors.text} />
              <Text style={t.styles.small}>Opening your inbox…</Text>
            </View>
          ) : !me ? (
            <View style={t.styles.center}>
              <Text style={t.styles.brand}>upstep ↗</Text>
              <Text style={t.styles.title}>Your customers, one tap away.</Text>
              <Text style={t.styles.text}>
                Get notified when someone needs a person. See what AI tried,
                take over and reply from your phone.
              </Text>
              <Button
                title={busy ? "Signing in…" : "Sign in to Upstep"}
                onPress={() => void login()}
                disabled={busy}
                primary
                t={t}
              />
              {!!error && (
                <Button
                  title="Try again"
                  onPress={() => {
                    setError("");
                    void loadMe().catch((e) => setError(describe(e)));
                  }}
                  t={t}
                />
              )}
              <Text style={t.styles.small}>
                Use the same Google or GitHub account as your dashboard.
              </Text>
              <Text style={t.styles.small}>Server: {serverUrl}</Text>
              <Button
                title="Change server"
                onPress={openServer}
                disabled={busy}
                t={t}
              />
              {!!error && (
                <Text accessibilityRole="alert" style={t.styles.error}>
                  {error}
                </Text>
              )}
            </View>
          ) : (
            <>
              <View style={t.styles.header}>
                <View style={t.styles.row}>
                  <Text style={t.styles.brand}>upstep ↗</Text>
                  <Button
                    title={settings ? "Inbox" : "Settings"}
                    onPress={() => {
                      setSettings(!settings);
                      setError("");
                    }}
                    t={t}
                  />
                </View>
                <Text style={t.styles.small}>
                  {project?.name || "Support inbox"} ·{" "}
                  {me.user.name || me.user.email}
                </Text>
              </View>
              {!!error && (
                <Text accessibilityRole="alert" style={t.styles.error}>
                  {error}
                </Text>
              )}
              {settings ? (
                <Settings
                  key={projectId}
                  t={t}
                  me={me}
                  projectId={projectId}
                  onProject={(id) => {
                    setProjectId(id);
                    setTarget(null);
                  }}
                  onRefresh={loadMe}
                  onChangeServer={openServer}
                />
              ) : !project ? (
                <View style={t.styles.center}>
                  <Text style={t.styles.title}>No support projects yet</Text>
                  <Text style={t.styles.text}>
                    Customer support is available on Pro and Business projects.
                    Set up a project in the web dashboard, then refresh.
                  </Text>
                  <Button
                    title="Refresh projects"
                    onPress={() =>
                      void loadMe().catch((e) => setError(describe(e)))
                    }
                    t={t}
                  />
                </View>
              ) : target ? (
                <Chat
                  key={`${target.projectId}:${target.conversationId}`}
                  target={target}
                  userId={me.user.id}
                  t={t}
                  active={active}
                  onBack={() => setTarget(null)}
                  draft={
                    (drafts.current[
                      `${me.user.id}:${target.conversationId}`
                    ] ||= { text: "", note: false, pending: null })
                  }
                />
              ) : (
                <InboxScreen
                  key={projectId}
                  projectId={project.id}
                  enabled={!!project.supportConfig?.enabled}
                  onOpen={(cid) =>
                    setTarget({ projectId: project.id, conversationId: cid })
                  }
                  t={t}
                  active={active}
                />
              )}
            </>
          )}
        </View>
        <Modal
          visible={showServer}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (!busy) setShowServer(false);
          }}
        >
          <SafeAreaView style={t.styles.screen}>
            <KeyboardAvoidingView
              style={t.styles.page}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 24, gap: 20 }}
              >
                <Text style={t.styles.title}>Your Upstep server</Text>
                <Text style={t.styles.text}>
                  Use upstep.dev or connect to your team’s self-hosted Upstep
                  instance.
                </Text>
                <Text style={t.styles.label}>Server address</Text>
                <TextInput
                  accessibilityLabel="Upstep server address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  value={serverInput}
                  onChangeText={setServerInput}
                  editable={!busy}
                  placeholder="https://upstep.dev"
                  placeholderTextColor={t.colors.muted}
                  style={[t.styles.input, { minHeight: 50, maxHeight: 60 }]}
                  onSubmitEditing={() => void saveServer()}
                />
                <Text style={t.styles.small}>
                  Changing servers signs you out on this phone. Your sign-in
                  stays private to the server you choose.
                </Text>
                {!!serverError && (
                  <Text accessibilityRole="alert" style={t.styles.error}>
                    {serverError}
                  </Text>
                )}
                <Button
                  title={busy ? "Saving…" : "Save server"}
                  primary
                  onPress={() => void saveServer()}
                  disabled={busy}
                  t={t}
                />
                <Button
                  title="Use upstep.dev"
                  onPress={() => setServerInput("https://upstep.dev")}
                  disabled={busy}
                  t={t}
                />
                {!!serverError && api.hasSession && (
                  <Button
                    title="Switch without reconnecting"
                    onPress={() =>
                      Alert.alert(
                        "Forget the previous sign-in?",
                        "If the previous server is unavailable, you can clear this phone’s sign-in. The previous server may keep its device session until it expires.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Forget and switch",
                            onPress: () => void saveServer(true),
                          },
                        ],
                      )
                    }
                    disabled={busy}
                    t={t}
                  />
                )}
                <Button
                  title="Cancel"
                  onPress={() => setShowServer(false)}
                  disabled={busy}
                  t={t}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const filters = [
  ["needs_human", "Needs a human"],
  ["mine", "Mine"],
  ["ai", "AI handling"],
  ["resolved", "Resolved"],
] as const;
function InboxScreen({
  projectId,
  enabled,
  onOpen,
  t,
  active,
}: {
  projectId: string;
  enabled: boolean;
  onOpen(id: string): void;
  t: Theme;
  active: boolean;
}) {
  const [filter, setFilter] = useState<string>("needs_human");
  const [data, setData] = useState<Inbox>({
    conversations: [],
    nextCursor: null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const inflight = useRef(false);
  const generation = useRef(0);
  const load = useCallback(
    async (more = false) => {
      if (inflight.current) return;
      inflight.current = true;
      const run = generation.current;
      try {
        const cursor =
          more && data.nextCursor
            ? `&cursor=${encodeURIComponent(data.nextCursor)}`
            : "";
        const next = await api.request<Inbox>(
          `${projectPath(projectId)}/inbox?filter=${filter}${cursor}`,
        );
        if (run !== generation.current) return;
        setData((old) =>
          more
            ? {
                ...next,
                conversations: [
                  ...old.conversations,
                  ...next.conversations.filter(
                    (c) => !old.conversations.some((o) => o.id === c.id),
                  ),
                ],
              }
            : next,
        );
        setError("");
      } catch (e) {
        if (run === generation.current) setError(describe(e));
      } finally {
        if (run === generation.current) setLoading(false);
        inflight.current = false;
      }
    },
    [projectId, filter, data.nextCursor],
  );
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    generation.current++;
    setData({ conversations: [], nextCursor: null });
    setLoading(true);
    // The preceding filter request may still be finishing; the timer retries safely.
    void loadRef.current();
    const timer = setInterval(() => {
      if (active) void loadRef.current();
    }, 5000);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [filter, active]);
  return (
    <View style={{ flex: 1 }}>
      <View style={t.styles.tabs}>
        {filters.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: value === filter }}
            onPress={() => setFilter(value)}
            style={[t.styles.tab, value === filter && t.styles.primary]}
          >
            <Text
              style={[t.styles.small, value === filter && t.styles.primaryText]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {!enabled && (
        <Text style={t.styles.error}>
          Support is disabled for this project. Existing conversations remain
          available.
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={data.conversations}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setLoading(true);
              void load();
            }}
            tintColor={t.colors.text}
          />
        }
        ListEmptyComponent={
          <View style={t.styles.center}>
            <Text style={t.styles.title}>
              {loading ? "Loading conversations…" : "You’re all caught up"}
            </Text>
            <Text style={t.styles.small}>
              {loading
                ? ""
                : "Pull to refresh. Enable notifications in Settings to hear when help is needed."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpen(item.id)}
            style={t.styles.item}
          >
            <View style={t.styles.row}>
              <Text style={t.styles.label}>
                {item.unread ? "● " : ""}
                {item.customer.name || "Visitor"}
              </Text>
              <Text style={t.styles.small}>
                {new Date(item.updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <Text numberOfLines={2} style={t.styles.text}>
              {item.messages[0]?.content || "New support conversation"}
            </Text>
            <Text style={t.styles.small}>
              {item.assignee?.name
                ? `Assigned to ${item.assignee.name}`
                : item.state === "AI" && !item.humanRequested
                  ? "AI is helping"
                  : "Waiting for your team"}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          data.nextCursor ? (
            <View style={{ padding: 16 }}>
              <Button title="Load more" onPress={() => void load(true)} t={t} />
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

function Chat({
  target,
  userId,
  onBack,
  t,
  active,
  draft,
}: {
  target: Target;
  userId: string;
  onBack(): void;
  t: Theme;
  active: boolean;
  draft: Draft;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const current = useRef<Conversation | null>(null);
  const [text, setText] = useState(draft.text);
  const [note, setNote] = useState(draft.note);
  const textByMode = useRef({
    reply: draft.note ? "" : draft.text,
    note: draft.note ? draft.text : "",
  });
  const changeMode = (value: boolean) => {
    textByMode.current[note ? "note" : "reply"] = text;
    const nextText = textByMode.current[value ? "note" : "reply"];
    setNote(value);
    draft.note = value;
    setText(nextText);
    draft.text = nextText;
    setSuggestion(null);
  };
  const [pending, setPending] = useState(draft.pending);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Assistance | null>(null);
  const [suggestion, setSuggestion] = useState<Assistance | null>(null);
  const [teammates, setTeammates] = useState<ProjectDetails["teammates"]>([]);
  const [assigning, setAssigning] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const alive = useRef(true);
  const loading = useRef(false);
  const path = conversationPath(target.projectId, target.conversationId);
  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const c = await api.request<Conversation>(path);
      if (!alive.current) return;
      current.current = c;
      setConversation(c);
      if (
        draft.pending &&
        c.messages.some((m) => m.clientMessageId === draft.pending?.id)
      ) {
        draft.pending = null;
        draft.text = "";
        setPending(null);
        setText("");
      }
      const last = c.messages.at(-1);
      if (last && activeRef.current)
        void api
          .request(
            `${projectPath(target.projectId)}/conversations/${encodeURIComponent(target.conversationId)}/read`,
            "POST",
            { messageId: last.id },
          )
          .catch(() => {});
    } catch (e) {
      if (alive.current) setError(describe(e));
    } finally {
      loading.current = false;
    }
  }, [path]);
  useEffect(() => {
    void api
      .request<ProjectDetails>(projectPath(target.projectId))
      .then((value) => {
        if (alive.current) setTeammates(value.teammates);
      })
      .catch(() => {});
  }, [target.projectId]);
  useEffect(() => {
    alive.current = true;
    if (active) void refresh();
    const timer = setInterval(() => {
      if (active) void refresh();
    }, 2500);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh, active]);
  const mutate = async (action: string, extra = {}) => {
    setBusy(true);
    setError("");
    try {
      await api.request(path, "POST", { action, ...extra });
      await refresh();
    } catch (e) {
      if (alive.current) setError(describe(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const send = async () => {
    if (!text.trim() || busy) return;
    if (
      !note &&
      suggestion &&
      suggestion.revision !== current.current?.revision
    ) {
      setError(
        "A new message arrived. Review the conversation before using another AI draft.",
      );
      setSuggestion(null);
      return;
    }
    const item = draft.pending || {
      id: Crypto.randomUUID(),
      text: text.trim(),
      note,
    };
    draft.pending = item;
    setPending(item);
    setBusy(true);
    setError("");
    try {
      await api.request(path, "POST", {
        action: item.note ? "note" : "reply",
        content: item.text,
        clientMessageId: item.id,
      });
      draft.pending = null;
      draft.text = "";
      if (alive.current) {
        setText("");
        setPending(null);
        setSuggestion(null);
        await refresh();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        draft.pending = null;
        if (alive.current) setPending(null);
      }
      if (alive.current) {
        setError(
          `${describe(e)}${draft.pending ? " Your draft is kept. Retry to confirm sending." : ""}`,
        );
        await refresh();
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const assist = async (intent: "summary" | "draft") => {
    setBusy(true);
    setError("");
    try {
      const answer = await api.request<Assistance>(`${path}/assist`, "POST", {
        intent,
      });
      if (!alive.current) return;
      if (answer.revision !== current.current?.revision) {
        setError("The conversation changed. Ask AI again after refreshing.");
        return;
      }
      if (intent === "summary") setSummary(answer);
      else {
        setSuggestion(answer);
        setText(answer.text);
        draft.text = answer.text;
      }
    } catch (e) {
      if (alive.current) setError(describe(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const mine =
    conversation?.state === "HUMAN" && conversation.assignedToId === userId;
  const stale = !!suggestion && suggestion.revision !== conversation?.revision;
  const label =
    conversation?.state === "HUMAN"
      ? mine
        ? "You’re replying · AI paused"
        : "Another teammate is replying"
      : conversation?.state === "RESOLVED"
        ? "Resolved"
        : conversation?.humanRequested || conversation?.state === "WAITING"
          ? "Needs a human"
          : "AI is helping";
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ padding: 16, gap: 8 }}>
        <View style={t.styles.row}>
          <Button title="← Inbox" onPress={onBack} t={t} />
          <Text style={t.styles.label}>
            {conversation?.customer.name || "Visitor"}
          </Text>
        </View>
        <Text style={t.styles.small}>
          {label}
          {conversation?.ticketReference
            ? ` · ${conversation.ticketReference}`
            : ""}
        </Text>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void refresh()}
            tintColor={t.colors.text}
          />
        }
      >
        {!conversation && <ActivityIndicator color={t.colors.text} />}
        {summary && (
          <View style={t.styles.card}>
            <Text style={t.styles.label}>
              AI handoff summary
              {summary.revision !== conversation?.revision
                ? " · Older version"
                : ""}
            </Text>
            <Text style={t.styles.text}>{summary.text}</Text>
          </View>
        )}
        {conversation?.messages.map((message) =>
          message.role === "SYSTEM" ? (
            <Text
              key={message.id}
              style={[t.styles.small, { textAlign: "center" }]}
            >
              {message.content}
            </Text>
          ) : (
            <View
              key={message.id}
              style={[
                t.styles.message,
                message.role === "AGENT" && t.styles.outgoing,
                message.role === "NOTE" && t.styles.note,
              ]}
            >
              <Text
                style={[
                  t.styles.small,
                  message.role === "AGENT" && { color: t.colors.ink },
                ]}
              >
                {message.role === "NOTE" ? "Private note · " : ""}
                {message.authorName}
              </Text>
              <Text
                selectable
                style={[
                  t.styles.text,
                  message.role === "AGENT" && { color: t.colors.ink },
                ]}
              >
                {message.content}
              </Text>
              <Text
                style={[
                  t.styles.small,
                  message.role === "AGENT" && { color: t.colors.ink },
                ]}
              >
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ),
        )}
      </ScrollView>
      {conversation && (
        <View style={t.styles.composer}>
          <View style={t.styles.row}>
            <Button
              title="AI summary"
              onPress={() => void assist("summary")}
              disabled={busy}
              t={t}
            />
            {conversation.state !== "RESOLVED" && (
              <Button
                title="Reassign"
                onPress={() => setAssigning(true)}
                disabled={busy}
                t={t}
              />
            )}
          </View>
          {conversation.state !== "RESOLVED" &&
            !mine &&
            conversation.state !== "HUMAN" && (
              <Button
                title={busy ? "Taking over…" : "Take over conversation"}
                onPress={() => void mutate("takeover")}
                primary
                disabled={busy}
                t={t}
              />
            )}
          {(mine || note) && conversation.state !== "RESOLVED" && (
            <>
              <View style={t.styles.row}>
                <Text style={t.styles.label}>
                  {note ? "Private team note" : "Your reply"}
                </Text>
                <Switch
                  accessibilityLabel="Private note"
                  value={note}
                  disabled={busy || !!pending}
                  onValueChange={changeMode}
                  trackColor={{ true: t.colors.accent }}
                />
              </View>
              <TextInput
                accessibilityLabel={note ? "Private note" : "Reply to customer"}
                multiline
                value={text}
                editable={!busy && !pending}
                maxLength={4000}
                onChangeText={(value) => {
                  setText(value);
                  draft.text = value;
                }}
                placeholder={
                  note
                    ? "Only your team can see this…"
                    : "Write to your customer…"
                }
                placeholderTextColor={t.colors.muted}
                style={t.styles.input}
              />
              {suggestion && (
                <Text
                  style={[t.styles.small, stale && { color: t.colors.error }]}
                >
                  {stale
                    ? "New activity since this AI draft. Review before sending."
                    : "AI draft · Review and edit before sending"}
                </Text>
              )}
              <View style={t.styles.row}>
                <Button
                  title={
                    busy
                      ? "Working…"
                      : pending
                        ? "Retry sending"
                        : note
                          ? "Save note"
                          : "Send reply"
                  }
                  onPress={() => void send()}
                  primary
                  disabled={busy || !text.trim()}
                  t={t}
                />
                {!note && (
                  <Button
                    title="Suggest reply"
                    onPress={() => void assist("draft")}
                    disabled={busy || !!pending || !!text.trim()}
                    t={t}
                  />
                )}
              </View>
            </>
          )}
          {mine && (
            <View style={t.styles.row}>
              <Button
                title="Resolve"
                onPress={() => void mutate("resolve")}
                disabled={busy || !!pending}
                t={t}
              />
              <Button
                title="Return to AI"
                onPress={() =>
                  Alert.alert(
                    "Return to AI?",
                    "The AI assistant will handle the next customer message.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Return to AI",
                        onPress: () => void mutate("ai"),
                      },
                    ],
                  )
                }
                disabled={busy || !!pending}
                t={t}
              />
            </View>
          )}
          {mine && (
            <Button
              title="Create task from conversation"
              onPress={() => void mutate("ticket")}
              disabled={busy}
              t={t}
            />
          )}
          {!mine && conversation.state !== "RESOLVED" && (
            <Button
              title={note ? "Close note" : "Add private note"}
              onPress={() => changeMode(!note)}
              disabled={busy || !!pending}
              t={t}
            />
          )}
          <Text style={t.styles.small}>
            AI assistance uses your project’s shared AI allowance.
          </Text>
        </View>
      )}
      <Modal
        visible={assigning}
        animationType="slide"
        onRequestClose={() => setAssigning(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={t.styles.screen}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <Text style={t.styles.title}>Assign this conversation</Text>
            {teammates.map((member) => (
              <Button
                key={member.id}
                title={`${member.id === userId ? "You" : member.name || "Teammate"}${member.id === conversation?.assignedToId ? " · Current assignee" : ""}`}
                onPress={() => {
                  setAssigning(false);
                  void mutate("assign", { assigneeId: member.id });
                }}
                t={t}
              />
            ))}
            <Button
              title="Return to unassigned queue"
              onPress={() => {
                setAssigning(false);
                void mutate("assign", { assigneeId: null });
              }}
              t={t}
            />
            <Button title="Cancel" onPress={() => setAssigning(false)} t={t} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Settings({
  t,
  me,
  projectId,
  onProject,
  onRefresh,
  onChangeServer,
}: {
  t: Theme;
  me: Me;
  projectId: string | null;
  onProject(id: string): void;
  onRefresh(): Promise<Me>;
  onChangeServer(): void;
}) {
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (projectId)
      void api
        .request<ProjectDetails>(projectPath(projectId))
        .then(setDetails)
        .catch((e) => setError(describe(e)));
  }, [projectId]);
  const update = async (value: Preferences, register = false) => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      if (register) await registerNotifications();
      await api.request(projectPath(projectId), "PUT", value);
      setDetails((old) => ({
        teammates: old?.teammates || [],
        preference: value,
      }));
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };
  const preference = details?.preference || {
    enabled: false,
    onCall: true,
    quietUntil: null,
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
      <Text style={t.styles.title}>Your support settings</Text>
      <View style={t.styles.card}>
        <Text style={t.styles.label}>Upstep server</Text>
        <Text style={t.styles.small}>{api.baseUrl}</Text>
        <Button title="Change server" onPress={onChangeServer} t={t} />
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <View style={t.styles.card}>
        <Text style={t.styles.label}>Projects</Text>
        {me.projects.map((project) => (
          <Button
            key={project.id}
            title={`${project.id === projectId ? "✓ " : ""}${project.name}`}
            onPress={() => onProject(project.id)}
            t={t}
          />
        ))}
        <Button
          title="Refresh projects"
          onPress={() => void onRefresh().catch((e) => setError(describe(e)))}
          t={t}
        />
      </View>
      {projectId && details && (
        <View style={t.styles.card}>
          <View style={t.styles.row}>
            <Text style={t.styles.label}>Mobile notifications</Text>
            <Switch
              accessibilityLabel="Mobile notifications"
              value={preference.enabled}
              disabled={busy}
              onValueChange={(enabled) =>
                void update({ ...preference, enabled }, enabled)
              }
              trackColor={{ true: t.colors.accent }}
            />
          </View>
          <Text style={t.styles.small}>
            Alerts for assignments and customer replies. Customer messages stay
            hidden on your lock screen.
          </Text>
          <View style={t.styles.row}>
            <Text style={t.styles.label}>On call for new requests</Text>
            <Switch
              accessibilityLabel="On call for unassigned requests"
              value={preference.onCall}
              disabled={busy || !preference.enabled}
              onValueChange={(onCall) => void update({ ...preference, onCall })}
              trackColor={{ true: t.colors.accent }}
            />
          </View>
          <Text style={t.styles.small}>
            Stay reachable when the app is closed. This does not show you as
            online to customers.
          </Text>
          <Button
            title={
              preference.quietUntil &&
              Date.parse(preference.quietUntil) > Date.now()
                ? "Resume notifications"
                : "Pause alerts for one hour"
            }
            onPress={() =>
              void update({
                ...preference,
                quietUntil:
                  preference.quietUntil &&
                  Date.parse(preference.quietUntil) > Date.now()
                    ? null
                    : new Date(Date.now() + 3600_000).toISOString(),
              })
            }
            disabled={busy || !preference.enabled}
            t={t}
          />
          <Button
            title="Register this phone again"
            onPress={() => void update({ ...preference, enabled: true }, true)}
            disabled={busy}
            t={t}
          />
        </View>
      )}
      <Button
        title={busy ? "Working…" : "Sign out and stop alerts on this phone"}
        onPress={() => {
          setBusy(true);
          void api.signOut().catch((e) => {
            setError(`Could not revoke this phone’s session. ${describe(e)}`);
            setBusy(false);
          });
        }}
        disabled={busy}
        t={t}
      />
    </ScrollView>
  );
}
