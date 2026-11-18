import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { notificationTarget, setActiveConversation } from "./notifications";
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
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Globe,
  Inbox as InboxIcon,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import { Avatar, Badge, Brand, Button, IconButton, SettingsRow } from "./ui";
import { Welcome } from "./Welcome";
import { NotificationSetup, AlertBanner } from "./NotificationSetup";
import { useAlertSetup, type AlertSetupController } from "./use-alert-setup";

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

export default function App() {
  const dark = useColorScheme() === "dark";
  const t = useMemo(() => theme(dark), [dark]);
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
  const [showProjects, setShowProjects] = useState(false);
  const [serverError, setServerError] = useState("");
  const [active, setActive] = useState(AppState.currentState === "active");
  const alerts = useAlertSetup(me?.user.id, projectId, serverUrl, active);
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
    const heartbeat = () => {
      const conversation =
        active && !settings && !alerts.showSetup ? target : null;
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
  }, [me, target, active, settings, alerts.showSetup]);
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
            <Welcome
              t={t}
              busy={busy}
              error={error}
              server={serverUrl}
              onLogin={() => void login()}
              onServer={openServer}
              onRetry={() => {
                setError("");
                void loadMe().catch((e) => setError(describe(e)));
              }}
            />
          ) : project && alerts.showSetup ? (
            <NotificationSetup
              key={alerts.context}
              alerts={alerts}
              projectName={project.name}
              onChooseProject={() => setShowProjects(true)}
              onComplete={() => {
                alerts.finish();
                setSettings(false);
                setTarget(null);
              }}
              t={t}
            />
          ) : project && alerts.checking && !alerts.loaded ? (
            <View style={t.styles.center}>
              <ActivityIndicator color={t.colors.forest} />
              <Text style={t.styles.small}>Preparing your workspace…</Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  t.styles.header,
                  target && !settings && { paddingBottom: 10 },
                ]}
              >
                <View style={t.styles.row}>
                  <Brand t={t} />
                  <View style={t.styles.inline}>
                    <IconButton
                      label="Customer alert setup"
                      icon={Bell}
                      onPress={alerts.open}
                      disabled={!project}
                      t={t}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Your account and settings"
                      onPress={() => setSettings(true)}
                    >
                      <Avatar
                        name={me.user.name || me.user.email}
                        size={40}
                        t={t}
                      />
                    </Pressable>
                  </View>
                </View>
                {(!target || settings) && (
                  <View style={t.styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Choose support workspace"
                      onPress={() => setShowProjects(true)}
                      style={{ gap: 5, flexShrink: 1 }}
                    >
                      <Text style={t.styles.eyebrow}>WORKSPACE</Text>
                      <View style={t.styles.inline}>
                        <Text
                          numberOfLines={1}
                          style={[
                            t.styles.label,
                            { fontSize: 17, flexShrink: 1 },
                          ]}
                        >
                          {project?.name || "Choose a project"}
                        </Text>
                        <ChevronDown size={15} color={t.colors.muted} />
                      </View>
                    </Pressable>
                    {project && (
                      <Badge
                        title={
                          alerts.checking
                            ? "Checking alerts"
                            : !alerts.ready
                              ? "Alerts off"
                              : alerts.paused
                                ? "Paused"
                                : alerts.preference?.onCall
                                  ? "On call"
                                  : "Assigned only"
                        }
                        kind={
                          (!alerts.ready && !alerts.checking) || alerts.paused
                            ? "human"
                            : "neutral"
                        }
                        t={t}
                      />
                    )}
                  </View>
                )}
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
                  alerts={alerts}
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
                  alerts={alerts}
                  projectId={project.id}
                  enabled={!!project.supportConfig?.enabled}
                  onOpen={(cid) =>
                    setTarget({ projectId: project.id, conversationId: cid })
                  }
                  t={t}
                  active={active}
                />
              )}
              {(!target || settings) && (
                <View style={t.styles.bottomBar}>
                  {[
                    [false, "Inbox", InboxIcon],
                    [true, "Settings", Settings2],
                  ].map(([isSettings, label, Icon]) => {
                    const selected = settings === isSettings;
                    const TabIcon = Icon as typeof InboxIcon;
                    return (
                      <Pressable
                        key={String(label)}
                        accessibilityRole="tab"
                        accessibilityLabel={String(label)}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setSettings(!!isSettings);
                          setError("");
                        }}
                        style={[
                          t.styles.navItem,
                          selected && { backgroundColor: t.colors.soft },
                        ]}
                      >
                        <TabIcon
                          size={21}
                          strokeWidth={selected ? 2 : 1.6}
                          color={selected ? t.colors.forest : t.colors.muted}
                        />
                        <Text
                          style={[
                            t.styles.navLabel,
                            selected && { color: t.colors.forest },
                          ]}
                        >
                          {String(label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
        <Modal
          visible={showProjects}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowProjects(false)}
        >
          <SafeAreaView style={t.styles.screen}>
            <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
              <View style={t.styles.row}>
                <Text style={t.styles.title}>Your workspaces</Text>
                <IconButton
                  label="Close workspaces"
                  icon={X}
                  onPress={() => setShowProjects(false)}
                  t={t}
                />
              </View>
              <Text style={t.styles.body}>
                Choose the team you’re here to help.
              </Text>
              {me?.projects.map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setProjectId(p.id);
                    setTarget(null);
                    setShowProjects(false);
                  }}
                  style={t.styles.card}
                >
                  <SettingsRow
                    title={p.name}
                    subtitle={
                      p.supportConfig?.enabled
                        ? "Customer support enabled"
                        : "Customer support paused"
                    }
                    icon={Users}
                    end={
                      p.id === projectId ? (
                        <Check size={21} color={t.colors.forest} />
                      ) : (
                        <ChevronRight size={18} color={t.colors.muted} />
                      )
                    }
                    t={t}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
  ["needs_human", "Needs you"],
  ["mine", "Assigned"],
  ["ai", "AI handling"],
  ["resolved", "Resolved"],
] as const;
function InboxScreen({
  projectId,
  enabled,
  onOpen,
  t,
  active,
  alerts,
}: {
  projectId: string;
  enabled: boolean;
  onOpen(id: string): void;
  t: Theme;
  active: boolean;
  alerts: AlertSetupController;
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
      <View
        style={[
          t.styles.section,
          t.styles.row,
          { alignItems: "flex-end", paddingTop: 0, paddingBottom: 20 },
        ]}
      >
        <View style={{ gap: 5 }}>
          <Text style={[t.styles.title, { fontSize: 34, lineHeight: 40 }]}>
            Your inbox
          </Text>
          <Text style={t.styles.small}>
            A human touch makes all the difference.
          </Text>
        </View>
        <View style={[t.styles.inline, { gap: 5, paddingBottom: 4 }]}>
          <View style={t.styles.statusDot} />
          <Text style={t.styles.eyebrow}>
            {active && !error ? "LIVE" : error ? "RETRY" : "PAUSED"}
          </Text>
        </View>
      </View>
      <AlertBanner alerts={alerts} t={t} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={t.styles.tabs}
      >
        {filters.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === filter }}
            onPress={() => setFilter(value)}
            style={({ pressed }) => [
              t.styles.tab,
              value === filter && t.styles.primary,
              pressed && t.styles.pressed,
            ]}
          >
            <Text
              style={[
                t.styles.small,
                { fontWeight: "600" },
                value === filter && t.styles.primaryText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {!enabled && (
        <Text style={t.styles.error}>
          Support is paused for this workspace. Existing conversations are still
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
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        keyExtractor={(c) => c.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              setLoading(true);
              void load();
            }}
            tintColor={t.colors.forest}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View
              accessibilityLabel="Loading conversations"
              style={{ paddingTop: 6 }}
            >
              {[0, 1, 2].map((i) => (
                <View key={i} style={[t.styles.item, { gap: 15 }]}>
                  <View style={t.styles.inline}>
                    <View style={t.styles.avatar} />
                    <View
                      style={{
                        height: 12,
                        width: "40%",
                        borderRadius: 5,
                        backgroundColor: t.colors.soft,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      height: 10,
                      width: "90%",
                      borderRadius: 5,
                      backgroundColor: t.colors.soft,
                    }}
                  />
                  <View
                    style={{
                      height: 10,
                      width: "60%",
                      borderRadius: 5,
                      backgroundColor: t.colors.soft,
                    }}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[t.styles.center, { minHeight: 290, paddingBottom: 50 }]}
            >
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 30,
                  backgroundColor: t.colors.soft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 7,
                }}
              >
                <InboxIcon
                  size={35}
                  strokeWidth={1.3}
                  color={t.colors.forest}
                />
                <View
                  style={{
                    position: "absolute",
                    right: -4,
                    bottom: 0,
                    backgroundColor: t.colors.accent,
                    borderRadius: 12,
                    padding: 5,
                    borderWidth: 3,
                    borderColor: t.colors.bg,
                  }}
                >
                  <Check size={14} color={t.colors.ink} />
                </View>
              </View>
              <Text style={[t.styles.title, { fontSize: 23 }]}>
                {error
                  ? "Let’s reconnect"
                  : filter === "resolved"
                    ? "Good endings start here"
                    : filter === "ai"
                      ? "No AI conversations yet"
                      : "All clear for now."}
              </Text>
              <Text
                style={[
                  t.styles.body,
                  { textAlign: "center", fontSize: 14, maxWidth: 270 },
                ]}
              >
                {error
                  ? "Pull down to try loading your conversations again."
                  : filter === "needs_human"
                    ? alerts.ready
                      ? "When someone needs a person, you’ll find their conversation here."
                      : "Human requests will appear here. Turn on alerts to hear when you’re needed."
                    : filter === "mine"
                      ? "Conversations you take over or get assigned will appear here."
                      : filter === "ai"
                        ? "Conversations your AI assistant is handling will appear here."
                        : "Resolved conversations will be saved here."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const name = item.customer.name || "Visitor";
          const kind =
            item.state === "RESOLVED"
              ? "resolved"
              : item.state === "AI" && !item.humanRequested
                ? "ai"
                : "human";
          const time = new Date(item.updatedAt);
          const sameDay = time.toDateString() === new Date().toDateString();
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name}${item.unread ? ", unread" : ""}. ${item.messages[0]?.content || "New support conversation"}`}
              onPress={() => onOpen(item.id)}
              style={({ pressed }) => [
                t.styles.item,
                item.unread && { borderColor: t.dark ? "#426c4d" : "#c6d9b7" },
                pressed && t.styles.pressed,
              ]}
            >
              <View style={[t.styles.inline, { alignItems: "flex-start" }]}>
                <Avatar name={name} t={t} />
                <View style={{ flex: 1, gap: 7 }}>
                  <View
                    style={[
                      t.styles.inline,
                      { justifyContent: "space-between", gap: 8 },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        t.styles.label,
                        { flex: 1, fontWeight: item.unread ? "700" : "600" },
                      ]}
                    >
                      {name}
                    </Text>
                    <Text style={[t.styles.small, { fontSize: 10 }]}>
                      {sameDay
                        ? time.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : time.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                    </Text>
                    {item.unread && <View style={t.styles.statusDot} />}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[
                      t.styles.text,
                      {
                        color: item.unread ? t.colors.text : t.colors.muted,
                        fontSize: 14,
                        lineHeight: 21,
                      },
                    ]}
                  >
                    {item.messages[0]?.content || "New support conversation"}
                  </Text>
                </View>
              </View>
              <View style={t.styles.row}>
                <Badge
                  title={
                    kind === "ai"
                      ? "AI is helping"
                      : kind === "resolved"
                        ? "Resolved"
                        : item.state === "HUMAN"
                          ? "With your team"
                          : "Needs a human"
                  }
                  kind={kind}
                  t={t}
                />
                <View style={[t.styles.inline, { gap: 5 }]}>
                  <Users size={11} color={t.colors.muted} />
                  <Text style={[t.styles.small, { fontSize: 10 }]}>
                    {item.assignee?.name || "Unassigned"}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          data.nextCursor ? (
            <View style={{ padding: 20 }}>
              <Button
                title="Load more conversations"
                onPress={() => void load(true)}
                t={t}
              />
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
  const [showActions, setShowActions] = useState(false);
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
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 15,
          gap: 13,
          borderBottomWidth: 1,
          borderColor: t.colors.line,
        }}
      >
        <View style={[t.styles.inline, { gap: 12 }]}>
          <IconButton
            label="Back to inbox"
            icon={ArrowLeft}
            onPress={onBack}
            t={t}
          />
          <Avatar
            name={conversation?.customer.name || "Visitor"}
            size={42}
            t={t}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={1} style={[t.styles.label, { fontSize: 17 }]}>
              {conversation?.customer.name || "Visitor"}
            </Text>
            <Text style={t.styles.small}>
              {conversation?.ticketReference || "Customer conversation"}
            </Text>
          </View>
          <IconButton
            label="Conversation actions"
            icon={MoreHorizontal}
            onPress={() => setShowActions(true)}
            t={t}
            disabled={!conversation}
          />
        </View>
        <View style={t.styles.row}>
          <Badge
            title={label}
            kind={
              conversation?.state === "RESOLVED"
                ? "resolved"
                : mine ||
                    conversation?.humanRequested ||
                    conversation?.state === "WAITING"
                  ? "human"
                  : "ai"
            }
            t={t}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !conversation}
            onPress={() => void assist("summary")}
            style={[t.styles.inline, { minHeight: 32, gap: 5 }]}
          >
            <Sparkles size={13} color={t.colors.forest} />
            <Text
              style={[
                t.styles.small,
                { color: t.colors.forest, fontWeight: "600" },
              ]}
            >
              AI summary
            </Text>
          </Pressable>
        </View>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void refresh()}
            tintColor={t.colors.forest}
          />
        }
      >
        {!conversation && <ActivityIndicator color={t.colors.forest} />}
        {conversation && (
          <View style={{ alignItems: "center", paddingVertical: 3 }}>
            <Text style={t.styles.eyebrow}>THE CONVERSATION SO FAR</Text>
          </View>
        )}
        {summary && (
          <View style={[t.styles.card, { backgroundColor: t.colors.soft }]}>
            <View style={t.styles.inline}>
              <Sparkles size={17} color={t.colors.forest} />
              <Text style={t.styles.label}>
                AI handoff summary
                {summary.revision !== conversation?.revision
                  ? " · Older version"
                  : ""}
              </Text>
            </View>
            <Text style={t.styles.text}>{summary.text}</Text>
            <Text style={t.styles.small}>Only visible to your team</Text>
          </View>
        )}
        {conversation?.messages.map((message) =>
          message.role === "SYSTEM" ? (
            <Text
              key={message.id}
              style={[
                t.styles.small,
                { textAlign: "center", fontSize: 10, paddingVertical: 5 },
              ]}
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
              <View style={[t.styles.inline, { gap: 5 }]}>
                {message.role === "NOTE" ? (
                  <NotebookPen size={11} color={t.colors.amber} />
                ) : message.role === "ASSISTANT" ? (
                  <Sparkles size={11} color={t.colors.forest} />
                ) : null}
                <Text
                  style={[
                    t.styles.small,
                    { fontWeight: "600", fontSize: 10 },
                    message.role === "AGENT" && { color: t.colors.ink },
                  ]}
                >
                  {message.role === "NOTE" ? "Private note · " : ""}
                  {message.authorName}
                </Text>
              </View>
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
                  { alignSelf: "flex-end", fontSize: 9 },
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
      {conversation && conversation.state !== "RESOLVED" && (
        <View style={t.styles.composer}>
          {!mine && conversation.state !== "HUMAN" && !note && (
            <>
              <Button
                title={busy ? "Taking over…" : "Take over & reply"}
                icon={MessageCircle}
                primary
                onPress={() => void mutate("takeover")}
                disabled={busy}
                t={t}
              />
              <Text
                style={[t.styles.small, { textAlign: "center", fontSize: 10 }]}
              >
                You’re in control. Customer-facing AI pauses when you take over.
              </Text>
            </>
          )}
          {(mine || note) && (
            <>
              <View style={t.styles.row}>
                <View style={t.styles.inline}>
                  {note ? (
                    <NotebookPen size={14} color={t.colors.amber} />
                  ) : (
                    <MessageCircle size={14} color={t.colors.forest} />
                  )}
                  <Text style={[t.styles.label, { fontSize: 12 }]}>
                    {note ? "Private team note" : "Reply to customer"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Private note"
                  accessibilityState={{
                    checked: note,
                    disabled: busy || !!pending,
                  }}
                  disabled={busy || !!pending}
                  onPress={() => changeMode(!note)}
                  style={{
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={[
                      t.styles.small,
                      {
                        fontWeight: "600",
                        color: note ? t.colors.amber : t.colors.forest,
                      },
                    ]}
                  >
                    {note ? "Switch to reply" : "Add a note"}
                  </Text>
                </Pressable>
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
                    ? "Just between your team…"
                    : "A thoughtful reply goes a long way…"
                }
                placeholderTextColor={t.colors.muted}
                style={[
                  t.styles.input,
                  {
                    minHeight: 74,
                    maxHeight: 135,
                    backgroundColor: note ? t.colors.note : t.colors.bg,
                  },
                ]}
              />
              {suggestion && (
                <Text
                  style={[
                    t.styles.small,
                    { fontSize: 10 },
                    stale && { color: t.colors.error },
                  ]}
                >
                  {stale
                    ? "New activity since this AI draft. Review before sending."
                    : "AI draft · Yours to review, edit, and send"}
                </Text>
              )}
              <View style={[t.styles.inline, { gap: 9 }]}>
                {!note && (
                  <Button
                    title="AI draft"
                    icon={Sparkles}
                    onPress={() => void assist("draft")}
                    disabled={busy || !!pending || !!text.trim()}
                    t={t}
                  />
                )}
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
                  icon={note ? NotebookPen : Send}
                  primary
                  onPress={() => void send()}
                  disabled={busy || !text.trim()}
                  t={t}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
          {!mine && (
            <Pressable
              accessibilityRole="button"
              disabled={busy || !!pending}
              onPress={() => changeMode(!note)}
              style={{
                minHeight: 36,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[t.styles.small, { fontWeight: "600" }]}>
                {note ? "Close private note" : "Add a private team note"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <Modal
        visible={showActions || assigning}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowActions(false);
          setAssigning(false);
        }}
      >
        <SafeAreaView style={t.styles.screen}>
          {assigning ? (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
              <View style={t.styles.row}>
                <Text style={t.styles.title}>Find the right person</Text>
                <IconButton
                  label="Close assignment"
                  icon={X}
                  onPress={() => setAssigning(false)}
                  t={t}
                />
              </View>
              {teammates.map((member) => (
                <Button
                  key={member.id}
                  title={`${member.id === userId ? "You" : member.name || "Teammate"}${member.id === conversation?.assignedToId ? " · Current assignee" : ""}`}
                  icon={Users}
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
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
              <View style={t.styles.row}>
                <Text style={t.styles.title}>Conversation</Text>
                <IconButton
                  label="Close conversation actions"
                  icon={X}
                  onPress={() => setShowActions(false)}
                  t={t}
                />
              </View>
              <Text style={t.styles.body}>
                The right next step, with a little help.
              </Text>
              <Button
                title="Get an AI summary"
                icon={Sparkles}
                onPress={() => {
                  setShowActions(false);
                  void assist("summary");
                }}
                disabled={busy}
                t={t}
              />
              {conversation?.state !== "RESOLVED" && (
                <Button
                  title="Reassign conversation"
                  icon={Users}
                  onPress={() => {
                    setShowActions(false);
                    setAssigning(true);
                  }}
                  disabled={busy}
                  t={t}
                />
              )}
              {mine && (
                <>
                  <Button
                    title="Mark as resolved"
                    icon={CheckCheck}
                    onPress={() => {
                      setShowActions(false);
                      void mutate("resolve");
                    }}
                    disabled={busy || !!pending}
                    primary
                    t={t}
                  />
                  <Button
                    title="Return to AI"
                    icon={Sparkles}
                    onPress={() => {
                      Alert.alert(
                        "Return to AI?",
                        "The AI assistant will handle the next customer message.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Return to AI",
                            onPress: () => {
                              setShowActions(false);
                              void mutate("ai");
                            },
                          },
                        ],
                      );
                    }}
                    disabled={busy || !!pending}
                    t={t}
                  />
                  <Button
                    title="Create a task from this conversation"
                    icon={NotebookPen}
                    onPress={() => {
                      setShowActions(false);
                      void mutate("ticket");
                    }}
                    disabled={busy}
                    t={t}
                  />
                </>
              )}
              <Text style={t.styles.small}>
                AI assistance uses your project’s shared AI allowance. Drafts
                are never sent automatically.
              </Text>
            </ScrollView>
          )}
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
  alerts,
}: {
  t: Theme;
  me: Me;
  projectId: string | null;
  onProject(id: string): void;
  onRefresh(): Promise<Me>;
  onChangeServer(): void;
  alerts: AlertSetupController;
}) {
  const [details, setDetails] = useState<ProjectDetails | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loadDetails = useCallback(async () => {
    if (!projectId) return;
    try {
      setDetails(await api.request<ProjectDetails>(projectPath(projectId)));
      setError("");
    } catch (e) {
      setError(describe(e));
    }
  }, [projectId]);
  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);
  const update = async (value: Preferences) => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      await api.request(projectPath(projectId), "PUT", value);
      setDetails((old) => ({
        teammates: old?.teammates || [],
        preference: value,
      }));
      await alerts.retry();
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
  const paused =
    !!preference.quietUntil && Date.parse(preference.quietUntil) > Date.now();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 28,
        gap: 22,
      }}
    >
      <View style={{ gap: 5, paddingHorizontal: 4 }}>
        <Text style={[t.styles.title, { fontSize: 34, lineHeight: 40 }]}>
          Settings
        </Text>
        <Text style={t.styles.small}>Your workspace. Your availability.</Text>
      </View>
      <View style={t.styles.card}>
        <View style={t.styles.inline}>
          <Avatar name={me.user.name || me.user.email} size={50} t={t} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[t.styles.label, { fontSize: 17 }]}>
              {me.user.name || "Your account"}
            </Text>
            <Text style={t.styles.small}>{me.user.email}</Text>
          </View>
        </View>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <View style={{ gap: 10 }}>
        <Text style={[t.styles.eyebrow, { paddingLeft: 4 }]}>
          STAY IN THE LOOP
        </Text>
        <View style={t.styles.card}>
          <SettingsRow
            title="Customer alerts"
            subtitle={
              alerts.ready
                ? "This phone is connected to your team."
                : "Get notified when you’re needed."
            }
            icon={Bell}
            t={t}
            end={
              <Switch
                accessibilityLabel="Mobile notifications"
                value={preference.enabled && alerts.ready}
                disabled={busy || !details}
                onValueChange={(enabled) =>
                  enabled
                    ? alerts.open()
                    : void update({ ...preference, enabled: false })
                }
                trackColor={{ true: t.colors.forest }}
                thumbColor={t.colors.card}
              />
            }
          />
          {!details ? (
            <Button
              title="Reload alert settings"
              onPress={() => void loadDetails()}
              t={t}
            />
          ) : (
            <>
              {!alerts.ready && (
                <Button
                  title="Set up customer alerts"
                  icon={ArrowRight}
                  primary
                  onPress={alerts.open}
                  t={t}
                />
              )}
              <View style={t.styles.divider} />
              <SettingsRow
                title="On call for new requests"
                subtitle="Help customers who haven’t been assigned yet."
                icon={Users}
                t={t}
                end={
                  <Switch
                    accessibilityLabel="On call for unassigned requests"
                    value={preference.onCall}
                    disabled={busy || !preference.enabled || !alerts.ready}
                    onValueChange={(onCall) =>
                      void update({ ...preference, onCall })
                    }
                    trackColor={{ true: t.colors.forest }}
                    thumbColor={t.colors.card}
                  />
                }
              />
              <View style={t.styles.divider} />
              <SettingsRow
                title={
                  paused ? "Resume customer alerts" : "Take a little break"
                }
                subtitle={
                  paused
                    ? "Alerts are paused for this workspace."
                    : "Pause alerts for one hour."
                }
                icon={Clock3}
                onPress={
                  preference.enabled && !busy
                    ? () =>
                        void update({
                          ...preference,
                          quietUntil: paused
                            ? null
                            : new Date(Date.now() + 3600_000).toISOString(),
                        })
                    : undefined
                }
                t={t}
              />
            </>
          )}
          <View
            style={[
              t.styles.inline,
              {
                backgroundColor: t.colors.soft,
                borderRadius: 12,
                padding: 12,
                alignItems: "flex-start",
              },
            ]}
          >
            <ShieldCheck size={14} color={t.colors.forest} />
            <Text style={[t.styles.small, { flex: 1, fontSize: 10 }]}>
              Customer messages stay hidden on your lock screen. Being on call
              doesn’t show you as online.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void Linking.openSettings().catch((e) => setError(describe(e)))
            }
            style={{
              minHeight: 36,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text
              style={[
                t.styles.small,
                { color: t.colors.forest, fontWeight: "600" },
              ]}
            >
              Phone notification settings
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={[t.styles.eyebrow, { paddingLeft: 4 }]}>
          YOUR WORKSPACES
        </Text>
        <View style={t.styles.card}>
          {me.projects.map((project, index) => (
            <React.Fragment key={project.id}>
              {index > 0 && <View style={t.styles.divider} />}
              <SettingsRow
                title={project.name}
                icon={Users}
                onPress={() => onProject(project.id)}
                end={
                  project.id === projectId ? (
                    <Check size={18} color={t.colors.forest} />
                  ) : (
                    <ChevronRight size={16} color={t.colors.muted} />
                  )
                }
                t={t}
              />
            </React.Fragment>
          ))}
          <Button
            title="Refresh workspaces"
            onPress={() => void onRefresh().catch((e) => setError(describe(e)))}
            t={t}
          />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={[t.styles.eyebrow, { paddingLeft: 4 }]}>CONNECTED TO</Text>
        <View style={t.styles.card}>
          <SettingsRow
            title={api.baseUrl.replace(/^https?:\/\//, "")}
            subtitle="Your Upstep server"
            icon={Globe}
            onPress={onChangeServer}
            t={t}
          />
        </View>
      </View>
      <Button
        title={busy ? "Signing out…" : "Sign out on this phone"}
        icon={LogOut}
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
      <Text style={[t.styles.small, { textAlign: "center", fontSize: 10 }]}>
        Signing out stops customer alerts on this phone.
      </Text>
    </ScrollView>
  );
}
