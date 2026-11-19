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
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
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
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  Inbox as InboxIcon,
  Lock,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  RotateCw,
  ScrollText,
  Sparkles,
  UserRound,
  X,
} from "lucide-react-native";
import {
  Avatar,
  Button,
  Chip,
  IconButton,
  SectionLabel,
  SettingsRow,
  Toggle,
  since,
} from "./ui";
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
  const availability = alerts.checking
    ? null
    : alerts.ready && !alerts.paused
      ? alerts.preference?.onCall
        ? "On call"
        : "Assigned only"
      : alerts.paused
        ? "Alerts paused"
        : "Alerts off";
  return (
    <SafeAreaProvider>
      <SafeAreaView style={t.styles.screen}>
        <StatusBar style={dark ? "light" : "dark"} />
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
              <ActivityIndicator color={t.colors.text} />
              <Text style={t.styles.small}>Preparing your workspace…</Text>
            </View>
          ) : settings ? (
            <Settings
              key={projectId}
              t={t}
              me={me}
              projectId={projectId}
              onClose={() => {
                setSettings(false);
                setError("");
              }}
              onProject={(id) => {
                setProjectId(id);
                setTarget(null);
              }}
              onRefresh={loadMe}
              onChangeServer={openServer}
              alerts={alerts}
            />
          ) : project && target ? (
            <Chat
              key={`${target.projectId}:${target.conversationId}`}
              target={target}
              userId={me.user.id}
              t={t}
              active={active}
              onBack={() => setTarget(null)}
              draft={
                (drafts.current[`${me.user.id}:${target.conversationId}`] ||= {
                  text: "",
                  note: false,
                  pending: null,
                })
              }
            />
          ) : (
            <>
              <View
                style={[
                  t.styles.row,
                  { paddingLeft: 20, paddingRight: 12, paddingTop: 6 },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Workspace: ${project?.name || "none"}. Switch workspace`}
                  onPress={() => setShowProjects(true)}
                  style={({ pressed }) => [
                    t.styles.inline,
                    { gap: 8, minHeight: 44, flexShrink: 1 },
                    pressed && t.styles.pressed,
                  ]}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: t.colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: t.colors.onPrimary,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      {(project?.name || "?").trim()[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[t.styles.label, { flexShrink: 1 }]}
                  >
                    {project?.name || "Choose a workspace"}
                  </Text>
                  <ChevronDown size={16} color={t.colors.faint} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Your account and settings${availability ? `. ${availability}` : ""}`}
                  onPress={() => setSettings(true)}
                  style={({ pressed }) => [
                    {
                      width: 44,
                      height: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    pressed && t.styles.pressed,
                  ]}
                >
                  <Avatar
                    name={me.user.name || me.user.email}
                    size={34}
                    round
                    t={t}
                  />
                  {project && alerts.loaded && !alerts.checking && (
                    <View
                      style={{
                        position: "absolute",
                        right: 4,
                        bottom: 5,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: t.colors.bg,
                        backgroundColor:
                          alerts.ready && !alerts.paused
                            ? t.colors.success
                            : alerts.paused
                              ? t.colors.noteIcon
                              : t.colors.line,
                      }}
                    />
                  )}
                </Pressable>
              </View>
              {!!error && (
                <Text accessibilityRole="alert" style={t.styles.error}>
                  {error}
                </Text>
              )}
              {!project ? (
                <View style={t.styles.center}>
                  <Text style={[t.styles.title, { textAlign: "center" }]}>
                    No support workspaces yet
                  </Text>
                  <Text style={[t.styles.body, { textAlign: "center" }]}>
                    Customer support is available on Pro and Business projects.
                    Set one up on the web, then refresh.
                  </Text>
                  <Button
                    title="Refresh workspaces"
                    onPress={() =>
                      void loadMe().catch((e) => setError(describe(e)))
                    }
                    t={t}
                  />
                </View>
              ) : (
                <InboxScreen
                  key={projectId}
                  alerts={alerts}
                  projectId={project.id}
                  userId={me.user.id}
                  availability={availability}
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
          visible={showProjects}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowProjects(false)}
        >
          <SafeAreaView style={t.styles.screen}>
            <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
              <View style={t.styles.row}>
                <Text style={t.styles.title}>Workspaces</Text>
                <IconButton
                  label="Close workspaces"
                  icon={X}
                  filled
                  onPress={() => setShowProjects(false)}
                  t={t}
                />
              </View>
              <View style={t.styles.group}>
                {me?.projects.map((p, index) => (
                  <React.Fragment key={p.id}>
                    {index > 0 && <View style={t.styles.divider} />}
                    <SettingsRow
                      title={p.name}
                      subtitle={
                        p.supportConfig?.enabled
                          ? "Customer support on"
                          : "Customer support paused"
                      }
                      onPress={() => {
                        setProjectId(p.id);
                        setTarget(null);
                        setShowProjects(false);
                      }}
                      end={
                        p.id === projectId ? (
                          <Check size={20} color={t.colors.text} />
                        ) : (
                          <ChevronRight size={18} color={t.colors.faint} />
                        )
                      }
                      t={t}
                    />
                  </React.Fragment>
                ))}
              </View>
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
  ["mine", "Mine"],
  ["ai", "AI"],
  ["resolved", "Resolved"],
] as const;
// A customer waiting this long gets the clay "overdue" treatment.
const LONG_WAIT_MINUTES = 10;
function InboxScreen({
  projectId,
  userId,
  availability,
  enabled,
  onOpen,
  t,
  active,
  alerts,
}: {
  projectId: string;
  userId: string;
  availability: string | null;
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
  const count = `${data.conversations.length}${data.nextCursor ? "+" : ""}`;
  const waitingSince = (c: Conversation) =>
    c.messages[0]?.createdAt || c.updatedAt;
  const oldest =
    filter === "needs_human"
      ? data.conversations.reduce<string | null>(
          (min, c) =>
            !min || Date.parse(waitingSince(c)) < Date.parse(min)
              ? waitingSince(c)
              : min,
          null,
        )
      : null;
  const ready = !loading || data.conversations.length > 0;
  const heading = !ready
    ? filters.find(([value]) => value === filter)?.[1]
    : filter === "needs_human"
      ? data.conversations.length
        ? `${count} waiting on you`
        : "No one’s waiting"
      : filter === "mine"
        ? `${count} assigned to you`
        : filter === "ai"
          ? `AI is handling ${count}`
          : `${count} resolved`;
  const live = active && !error;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16, gap: 6 }}>
        <Text accessibilityRole="header" style={t.styles.largeTitle}>
          {heading}
        </Text>
        <View style={[t.styles.inline, { gap: 6 }]}>
          <View
            style={[
              t.styles.dot,
              {
                width: 6,
                height: 6,
                backgroundColor: live ? t.colors.success : t.colors.faint,
              },
            ]}
          />
          <Text style={[t.styles.small, { color: t.colors.muted, flexShrink: 1 }]}>
            {[
              live ? "Live" : error ? "Reconnecting" : "Paused",
              oldest ? `longest wait ${since(oldest)}` : null,
              availability,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>
      <AlertBanner alerts={alerts} t={t} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 10 }}
      >
        {filters.map(([value, label]) => {
          const selected = value === filter;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [
                t.styles.pill,
                selected && { backgroundColor: t.colors.primary },
                pressed && t.styles.pressed,
              ]}
            >
              <Text
                style={[
                  t.styles.pillText,
                  selected && { color: t.colors.onPrimary, fontWeight: "600" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!enabled && (
        <Text style={[t.styles.small, { paddingHorizontal: 20, paddingBottom: 6 }]}>
          Support is paused for this workspace. Existing conversations are
          still here.
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <FlatList
        data={data.conversations}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={() => (
          <View style={[t.styles.divider, { marginLeft: 72 }]} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading && data.conversations.length > 0}
            onRefresh={() => {
              setLoading(true);
              void load();
            }}
            tintColor={t.colors.text}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View accessibilityLabel="Loading conversations">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: t.colors.soft,
                    }}
                  />
                  <View style={{ flex: 1, gap: 9, paddingTop: 4 }}>
                    {["45%", "90%", "60%"].map((width) => (
                      <View
                        key={width}
                        style={{
                          height: 10,
                          width: width as `${number}%`,
                          borderRadius: 5,
                          backgroundColor: t.colors.soft,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[t.styles.center, { minHeight: 280, paddingBottom: 60 }]}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: t.colors.soft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {error ? (
                  <RotateCw size={26} strokeWidth={1.7} color={t.colors.text} />
                ) : filter === "needs_human" ? (
                  <Check size={28} strokeWidth={2} color={t.colors.text} />
                ) : (
                  <InboxIcon size={26} strokeWidth={1.7} color={t.colors.text} />
                )}
              </View>
              <Text style={[t.styles.title, { textAlign: "center" }]}>
                {error
                  ? "Can’t reach your inbox"
                  : filter === "needs_human"
                    ? "All clear"
                    : filter === "mine"
                      ? "Nothing assigned to you"
                      : filter === "ai"
                        ? "AI isn’t handling anything"
                        : "Nothing resolved yet"}
              </Text>
              <Text
                style={[t.styles.small, { textAlign: "center", maxWidth: 270, fontSize: 14, lineHeight: 20 }]}
              >
                {error
                  ? "Pull down to try again."
                  : filter === "needs_human"
                    ? alerts.ready
                      ? "When a customer needs a person, they’ll show up here and you’ll get a tap."
                      : "When a customer needs a person, they’ll show up here. Turn on alerts to get a tap."
                    : filter === "mine"
                      ? "Conversations you take over or are given land here."
                      : filter === "ai"
                        ? "Conversations AI is answering on its own show up here."
                        : "Resolved conversations are kept here."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const name = item.customer.name || "Visitor";
          const preview =
            item.messages[0]?.content || "New support conversation";
          const waiting =
            filter === "needs_human" || (filter === "mine" && item.unread);
          const at = waiting ? waitingSince(item) : item.updatedAt;
          const overdue =
            filter === "needs_human" &&
            Date.now() - Date.parse(at) >= LONG_WAIT_MINUTES * 60_000;
          const chips: { title: string; tone?: "clay"; icon?: typeof Check }[] =
            [];
          if (item.state === "RESOLVED")
            chips.push({ title: "Resolved", icon: Check });
          else if (item.state === "HUMAN")
            chips.push({
              title:
                item.assignedToId === userId
                  ? "Assigned to you"
                  : `With ${item.assignee?.name || "a teammate"}`,
            });
          else if (item.humanRequested)
            chips.push({ title: "Asked for a person", tone: "clay" });
          else if (item.state === "WAITING")
            chips.push({ title: "Needs a person", tone: "clay" });
          else chips.push({ title: "AI is replying", icon: Sparkles });
          if (
            item.state !== "HUMAN" &&
            item.state !== "RESOLVED" &&
            filter === "needs_human"
          )
            chips.push({
              title: item.assignee?.name
                ? item.assignedToId === userId
                  ? "Assigned to you"
                  : `For ${item.assignee.name}`
                : "Unassigned",
            });
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${name}${item.unread ? ", unread" : ""}${waiting ? `, waiting ${since(at)}` : ""}. ${preview}`}
              onPress={() => onOpen(item.id)}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 13,
                },
                pressed && { backgroundColor: t.colors.surface },
              ]}
            >
              <Avatar name={name} t={t} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[t.styles.inline, { gap: 8 }]}>
                  <Text
                    numberOfLines={1}
                    style={[
                      t.styles.label,
                      { flex: 1, fontWeight: item.unread ? "700" : "500" },
                    ]}
                  >
                    {name}
                  </Text>
                  {item.unread && (
                    <View
                      style={[t.styles.dot, { backgroundColor: t.colors.clay }]}
                    />
                  )}
                  <View style={[t.styles.inline, { gap: 4 }]}>
                    {overdue && (
                      <Clock3 size={13} strokeWidth={2.4} color={t.colors.clay} />
                    )}
                    <Text
                      style={[
                        t.styles.small,
                        overdue
                          ? { color: t.colors.clay, fontWeight: "600" }
                          : item.unread && { color: t.colors.body, fontWeight: "600" },
                      ]}
                    >
                      {since(at)}
                    </Text>
                  </View>
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    t.styles.text,
                    {
                      fontSize: 14,
                      lineHeight: 20,
                      color: item.unread ? t.colors.body : t.colors.faint,
                    },
                  ]}
                >
                  {preview}
                </Text>
                <View style={[t.styles.inline, { gap: 6, paddingTop: 3, flexWrap: "wrap" }]}>
                  {chips.map((chip) => (
                    <Chip
                      key={chip.title}
                      title={chip.title}
                      tone={chip.tone}
                      icon={chip.icon}
                      t={t}
                    />
                  ))}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          data.nextCursor ? (
            <View style={{ padding: 20 }}>
              <Button
                title="Load more"
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
  const needsPerson =
    conversation?.state !== "HUMAN" &&
    conversation?.state !== "RESOLVED" &&
    (conversation?.humanRequested || conversation?.state === "WAITING");
  const label =
    conversation?.state === "HUMAN"
      ? mine
        ? "You’re replying · AI paused"
        : `${conversation.assignee?.name || "A teammate"} is replying`
      : conversation?.state === "RESOLVED"
        ? "Resolved"
        : needsPerson
          ? "Needs a person"
          : "AI is replying";
  const statusColor = mine
    ? t.colors.success
    : needsPerson
      ? t.colors.clay
      : t.colors.faint;
  const name = conversation?.customer.name || "Visitor";
  const close = () => setShowActions(false);
  const canSend = !!text.trim() && !busy;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          t.styles.inline,
          {
            gap: 4,
            paddingHorizontal: 6,
            paddingTop: 2,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderColor: t.colors.hairline,
          },
        ]}
      >
        <IconButton
          label="Back to inbox"
          icon={ChevronLeft}
          onPress={onBack}
          t={t}
        />
        <Avatar name={name} size={36} t={t} />
        <View style={{ flex: 1, gap: 1, paddingLeft: 6 }}>
          <Text numberOfLines={1} style={[t.styles.label, { fontSize: 16 }]}>
            {name}
          </Text>
          <Text numberOfLines={1} style={[t.styles.small, { fontSize: 12 }]}>
            {[conversation?.ticketReference, conversation?.customer.email]
              .filter(Boolean)
              .join(" · ") || "Customer conversation"}
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
      {conversation && (
        <View
          style={[
            t.styles.inline,
            {
              gap: 8,
              paddingLeft: 20,
              paddingRight: 12,
              minHeight: 40,
              backgroundColor: t.colors.surface,
              borderBottomWidth: 1,
              borderColor: t.colors.hairline,
            },
          ]}
        >
          <View
            style={[t.styles.dot, { width: 7, height: 7, backgroundColor: statusColor }]}
          />
          <Text style={[t.styles.small, { flex: 1, color: t.colors.body }]}>
            {label}
          </Text>
          {!summary && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get an AI summary of this conversation"
              disabled={busy}
              onPress={() => void assist("summary")}
              style={({ pressed }) => [
                t.styles.inline,
                { gap: 5, minHeight: 40, paddingHorizontal: 8 },
                (pressed || busy) && t.styles.pressed,
              ]}
            >
              <Sparkles size={14} color={t.colors.text} strokeWidth={2} />
              <Text style={[t.styles.small, { color: t.colors.text, fontWeight: "600" }]}>
                Summarize
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={t.styles.error}>
          {error}
        </Text>
      )}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void refresh()}
            tintColor={t.colors.text}
          />
        }
      >
        {!conversation && (
          <ActivityIndicator color={t.colors.text} style={{ marginTop: 40 }} />
        )}
        {summary && (
          <View style={[t.styles.card, { gap: 6, paddingVertical: 12 }]}>
            <View style={[t.styles.inline, { gap: 6 }]}>
              <Sparkles size={14} color={t.colors.text} strokeWidth={2} />
              <Text style={[t.styles.label, { fontSize: 12, flex: 1 }]}>
                What happened so far
                {summary.revision !== conversation?.revision
                  ? " · older version"
                  : ""}
              </Text>
              <Text style={[t.styles.small, { fontSize: 11 }]}>
                Only your team sees this
              </Text>
            </View>
            <Text selectable style={[t.styles.text, { fontSize: 14, lineHeight: 20 }]}>
              {summary.text}
            </Text>
          </View>
        )}
        {conversation?.messages.map((message) => {
          const time = new Date(message.createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          if (message.role === "SYSTEM")
            return (
              <View
                key={message.id}
                style={[t.styles.inline, { gap: 10, paddingVertical: 4 }]}
              >
                <View style={[t.styles.divider, { flex: 1 }]} />
                <Text
                  style={[
                    t.styles.small,
                    { fontSize: 11, fontWeight: "500", flexShrink: 1, textAlign: "center" },
                  ]}
                >
                  {message.content} · {time}
                </Text>
                <View style={[t.styles.divider, { flex: 1 }]} />
              </View>
            );
          if (message.role === "NOTE")
            return (
              <View
                key={message.id}
                style={{
                  backgroundColor: t.colors.note,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <Lock size={14} color={t.colors.noteIcon} strokeWidth={2} style={{ marginTop: 3 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text selectable style={{ color: t.colors.noteText, fontSize: 14, lineHeight: 20 }}>
                    <Text style={{ fontWeight: "600" }}>{message.authorName}: </Text>
                    {message.content}
                  </Text>
                  <Text style={{ color: t.colors.noteIcon, fontSize: 11 }}>
                    Private note · {time}
                  </Text>
                </View>
              </View>
            );
          const outgoing = message.role === "AGENT" || message.role === "ASSISTANT";
          const ai = message.role === "ASSISTANT";
          return (
            <View
              key={message.id}
              style={{
                alignSelf: outgoing ? "flex-end" : "flex-start",
                maxWidth: "84%",
                alignItems: outgoing ? "flex-end" : "flex-start",
                gap: 4,
              }}
            >
              {outgoing && (
                <View style={[t.styles.inline, { gap: 4 }]}>
                  {ai && <Sparkles size={11} color={t.colors.faint} />}
                  <Text style={[t.styles.small, { fontSize: 11 }]}>
                    {message.authorName}
                  </Text>
                </View>
              )}
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 18,
                  ...(outgoing
                    ? { borderBottomRightRadius: 6 }
                    : { borderBottomLeftRadius: 6 }),
                  backgroundColor:
                    message.role === "AGENT"
                      ? t.colors.primary
                      : ai
                        ? t.colors.bg
                        : t.colors.soft,
                  borderWidth: ai ? 1 : 0,
                  borderColor: t.colors.line,
                }}
              >
                <Text
                  selectable
                  style={{
                    fontSize: 15,
                    lineHeight: 21,
                    color:
                      message.role === "AGENT"
                        ? t.colors.onPrimary
                        : ai
                          ? t.colors.body
                          : t.colors.text,
                  }}
                >
                  {message.content}
                </Text>
              </View>
              <Text style={[t.styles.small, { fontSize: 11 }]}>{time}</Text>
            </View>
          );
        })}
      </ScrollView>
      {conversation && conversation.state !== "RESOLVED" && (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: t.colors.hairline,
            backgroundColor: t.colors.bg,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
            gap: 10,
          }}
        >
          {!mine && !note ? (
            <>
              {conversation.state !== "HUMAN" && (
                <Button
                  title={busy ? "Taking over…" : "Take over and reply"}
                  primary
                  onPress={() => void mutate("takeover")}
                  disabled={busy}
                  t={t}
                  style={{ minHeight: 52 }}
                />
              )}
              <View style={[t.styles.row, { justifyContent: "center", gap: 16 }]}>
                {conversation.state !== "HUMAN" && (
                  <Text style={[t.styles.small, { flexShrink: 1 }]}>
                    AI pauses while you reply.
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !!pending}
                  onPress={() => changeMode(true)}
                  style={({ pressed }) => [
                    t.styles.inline,
                    { gap: 5, minHeight: 36 },
                    pressed && t.styles.pressed,
                  ]}
                >
                  <Lock size={13} color={t.colors.text} strokeWidth={2} />
                  <Text style={[t.styles.small, { color: t.colors.text, fontWeight: "600" }]}>
                    Add a private note
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {suggestion && !note ? (
                <View style={[t.styles.inline, { gap: 6 }]}>
                  <Sparkles
                    size={14}
                    color={stale ? t.colors.error : t.colors.clay}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      t.styles.small,
                      {
                        flex: 1,
                        fontWeight: "600",
                        color: stale ? t.colors.error : t.colors.clay,
                      },
                    ]}
                  >
                    {stale
                      ? "New activity since this draft — review it"
                      : "AI draft · review before sending"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Discard AI draft"
                    disabled={busy || !!pending}
                    onPress={() => {
                      setSuggestion(null);
                      setText("");
                      draft.text = "";
                    }}
                    style={{ minHeight: 32, justifyContent: "center", paddingHorizontal: 4 }}
                  >
                    <Text style={[t.styles.small, { fontWeight: "500" }]}>Discard</Text>
                  </Pressable>
                </View>
              ) : note ? (
                <View style={[t.styles.inline, { gap: 6 }]}>
                  <Lock size={13} color={t.colors.noteIcon} strokeWidth={2} />
                  <Text style={[t.styles.small, { flex: 1, color: t.colors.noteIcon, fontWeight: "600" }]}>
                    Private note · only your team sees this
                  </Text>
                </View>
              ) : (
                !text.trim() && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || !!pending}
                    onPress={() => void assist("draft")}
                    style={({ pressed }) => [
                      t.styles.inline,
                      {
                        alignSelf: "flex-start",
                        gap: 6,
                        height: 34,
                        paddingHorizontal: 12,
                        borderRadius: 17,
                        borderWidth: 1,
                        borderColor: t.colors.line,
                      },
                      (pressed || busy) && t.styles.pressed,
                    ]}
                  >
                    <Sparkles size={14} color={t.colors.clay} strokeWidth={2} />
                    <Text style={[t.styles.small, { color: t.colors.text, fontWeight: "600" }]}>
                      {busy ? "Drafting…" : "Draft a reply with AI"}
                    </Text>
                  </Pressable>
                )
              )}
              <View style={[t.styles.inline, { alignItems: "flex-end", gap: 8 }]}>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Private note"
                  accessibilityState={{ checked: note, disabled: busy || !!pending }}
                  disabled={busy || !!pending}
                  onPress={() => changeMode(!note)}
                  style={({ pressed }) => [
                    t.styles.roundButton,
                    note && { backgroundColor: t.colors.note },
                    pressed && t.styles.pressed,
                  ]}
                >
                  {note && !mine ? (
                    <X size={19} color={t.colors.noteIcon} strokeWidth={2} />
                  ) : (
                    <Lock
                      size={18}
                      color={note ? t.colors.noteIcon : t.colors.body}
                      strokeWidth={1.9}
                    />
                  )}
                </Pressable>
                <TextInput
                  accessibilityLabel={note ? "Private note" : `Reply to ${name}`}
                  multiline
                  value={text}
                  editable={!busy && !pending}
                  maxLength={4000}
                  onChangeText={(value) => {
                    setText(value);
                    draft.text = value;
                  }}
                  placeholder={note ? "Note for your team…" : `Reply to ${name.split(" ")[0]}…`}
                  placeholderTextColor={t.colors.faint}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    maxHeight: 140,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: note ? t.colors.note : t.colors.line,
                    backgroundColor: note ? t.colors.note : t.colors.bg,
                    color: note ? t.colors.noteText : t.colors.text,
                    fontSize: 16,
                    lineHeight: 21,
                    paddingHorizontal: 16,
                    paddingTop: 11,
                    paddingBottom: 11,
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pending ? "Retry sending" : note ? "Save note" : "Send reply"
                  }
                  accessibilityState={{ disabled: !canSend, busy }}
                  disabled={!canSend}
                  onPress={() => void send()}
                  style={({ pressed }) => [
                    t.styles.roundButton,
                    { backgroundColor: note ? t.colors.primary : t.colors.clay },
                    !canSend && !busy && t.styles.disabled,
                    pressed && t.styles.pressed,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={note ? t.colors.onPrimary : t.colors.onClay} />
                  ) : pending ? (
                    <RotateCw size={19} color={note ? t.colors.onPrimary : t.colors.onClay} strokeWidth={2.2} />
                  ) : note ? (
                    <Check size={20} color={t.colors.onPrimary} strokeWidth={2.4} />
                  ) : (
                    <ArrowUp size={20} color={t.colors.onClay} strokeWidth={2.4} />
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
      <ActionSheet
        visible={showActions}
        onClose={close}
        t={t}
        title={name}
        subtitle={label}
      >
        {mine && (
          <Button
            title="Mark resolved"
            icon={Check}
            primary
            onPress={() => {
              close();
              void mutate("resolve");
            }}
            disabled={busy || !!pending}
            t={t}
            style={{ minHeight: 52 }}
          />
        )}
        {conversation?.state !== "RESOLVED" && teammates.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ paddingHorizontal: 4 }}>
              <SectionLabel title="Assign to" t={t} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 4, paddingVertical: 4 }}
            >
              {[...teammates]
                .sort((a, b) => Number(b.id === userId) - Number(a.id === userId))
                .map((member) => {
                  const current = member.id === conversation?.assignedToId;
                  const who =
                    member.id === userId
                      ? "You"
                      : (member.name || "Teammate").split(" ")[0];
                  return (
                    <Pressable
                      key={member.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Assign to ${member.id === userId ? "yourself" : member.name || "teammate"}`}
                      accessibilityState={{ selected: current, disabled: busy }}
                      disabled={busy}
                      onPress={() => {
                        close();
                        void mutate("assign", { assigneeId: member.id });
                      }}
                      style={({ pressed }) => [
                        { width: 60, alignItems: "center", gap: 6 },
                        pressed && t.styles.pressed,
                      ]}
                    >
                      <View
                        style={{
                          padding: 2,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: current ? t.colors.primary : "transparent",
                        }}
                      >
                        <Avatar name={member.name || "Teammate"} size={46} round t={t} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          t.styles.small,
                          { fontSize: 12, color: current ? t.colors.text : t.colors.body },
                          current && { fontWeight: "600" },
                        ]}
                      >
                        {who}
                      </Text>
                    </Pressable>
                  );
                })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return to the unassigned queue"
                disabled={busy}
                onPress={() => {
                  close();
                  void mutate("assign", { assigneeId: null });
                }}
                style={({ pressed }) => [
                  { width: 60, alignItems: "center", gap: 6 },
                  pressed && t.styles.pressed,
                ]}
              >
                <View
                  style={{
                    margin: 4,
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: t.colors.faint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <InboxIcon size={19} color={t.colors.muted} strokeWidth={1.9} />
                </View>
                <Text style={[t.styles.small, { fontSize: 12, color: t.colors.body }]}>
                  Queue
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
        <View style={t.styles.group}>
          {mine && (
            <>
              <SettingsRow
                title="Hand back to AI"
                subtitle="AI answers the next customer message"
                icon={Sparkles}
                disabled={busy || !!pending}
                onPress={() =>
                  Alert.alert(
                    "Hand back to AI?",
                    "The AI assistant will handle the next customer message.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Hand back",
                        onPress: () => {
                          close();
                          void mutate("ai");
                        },
                      },
                    ],
                  )
                }
                end={<View />}
                t={t}
              />
              <View style={t.styles.divider} />
              <SettingsRow
                title="Create a task"
                subtitle="Adds this conversation to your project board"
                icon={NotebookPen}
                disabled={busy}
                onPress={() => {
                  close();
                  void mutate("ticket");
                }}
                end={<View />}
                t={t}
              />
              <View style={t.styles.divider} />
            </>
          )}
          <SettingsRow
            title={summary ? "Refresh summary" : "Summarize with AI"}
            subtitle="Private to your team"
            icon={ScrollText}
            disabled={busy}
            onPress={() => {
              close();
              void assist("summary");
            }}
            end={<View />}
            t={t}
          />
        </View>
        <Text style={[t.styles.small, { textAlign: "center", fontSize: 12 }]}>
          AI help uses your project’s AI allowance. Nothing is sent without you.
        </Text>
      </ActionSheet>
    </KeyboardAvoidingView>
  );
}

function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  t,
  children,
}: {
  visible: boolean;
  onClose(): void;
  title: string;
  subtitle: string;
  t: Theme;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close actions"
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.colors.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
            backgroundColor: t.colors.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 4,
            gap: 16,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 5,
              borderRadius: 3,
              backgroundColor: t.colors.line,
            }}
          />
          <View style={[t.styles.inline, { gap: 12, paddingLeft: 4 }]}>
            <Avatar name={title} t={t} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[t.styles.label, { fontSize: 17 }]}>
                {title}
              </Text>
              <Text numberOfLines={1} style={t.styles.small}>
                {subtitle}
              </Text>
            </View>
            <IconButton label="Close" icon={X} filled onPress={onClose} t={t} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function Settings({
  t,
  me,
  projectId,
  onClose,
  onProject,
  onRefresh,
  onChangeServer,
  alerts,
}: {
  t: Theme;
  me: Me;
  projectId: string | null;
  onClose(): void;
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
    <View style={{ flex: 1 }}>
      <View style={[t.styles.inline, { paddingHorizontal: 6, paddingTop: 2 }]}>
        <IconButton
          label="Back to inbox"
          icon={ChevronLeft}
          onPress={onClose}
          t={t}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 28,
          gap: 24,
        }}
      >
        <Text accessibilityRole="header" style={t.styles.largeTitle}>
          Settings
        </Text>
        <View style={[t.styles.inline, { gap: 14 }]}>
          <Avatar name={me.user.name || me.user.email} size={52} round t={t} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[t.styles.label, { fontSize: 17 }]}>
              {me.user.name || "Your account"}
            </Text>
            <Text style={t.styles.small}>{me.user.email}</Text>
          </View>
        </View>
        {!!error && (
          <Text
            accessibilityRole="alert"
            style={[t.styles.error, { paddingHorizontal: 0 }]}
          >
            {error}
          </Text>
        )}
        <View style={{ gap: 10 }}>
          <SectionLabel title="Availability" t={t} />
          <View style={t.styles.group}>
            <SettingsRow
              title="Customer alerts"
              subtitle={
                alerts.ready
                  ? "This phone is connected."
                  : "Get a tap when you’re needed."
              }
              icon={Bell}
              t={t}
              end={
                <Toggle
                  label="Mobile notifications"
                  value={preference.enabled && alerts.ready}
                  disabled={busy || !details}
                  onValueChange={(enabled) =>
                    enabled
                      ? alerts.open()
                      : void update({ ...preference, enabled: false })
                  }
                  t={t}
                />
              }
            />
            {!details ? (
              <>
                <View style={t.styles.divider} />
                <SettingsRow
                  title="Reload alert settings"
                  icon={RotateCw}
                  onPress={() => void loadDetails()}
                  t={t}
                />
              </>
            ) : (
              <>
                {!alerts.ready && (
                  <>
                    <View style={t.styles.divider} />
                    <SettingsRow
                      title="Set up customer alerts"
                      icon={ArrowRight}
                      onPress={alerts.open}
                      t={t}
                    />
                  </>
                )}
                <View style={t.styles.divider} />
                <SettingsRow
                  title="On call for new requests"
                  subtitle="Also hear about unassigned customers."
                  icon={UserRound}
                  t={t}
                  end={
                    <Toggle
                      label="On call for unassigned requests"
                      value={preference.onCall}
                      disabled={busy || !preference.enabled || !alerts.ready}
                      onValueChange={(onCall) =>
                        void update({ ...preference, onCall })
                      }
                      t={t}
                    />
                  }
                />
                <View style={t.styles.divider} />
                <SettingsRow
                  title={paused ? "Resume alerts" : "Pause for an hour"}
                  subtitle={
                    paused
                      ? "Alerts are paused for this workspace."
                      : "Take a break without turning alerts off."
                  }
                  icon={Clock3}
                  disabled={!preference.enabled || busy}
                  onPress={() =>
                    void update({
                      ...preference,
                      quietUntil: paused
                        ? null
                        : new Date(Date.now() + 3600_000).toISOString(),
                    })
                  }
                  t={t}
                />
              </>
            )}
            <View style={t.styles.divider} />
            <SettingsRow
              title="Phone notification settings"
              icon={ArrowRight}
              onPress={() =>
                void Linking.openSettings().catch((e) => setError(describe(e)))
              }
              t={t}
            />
          </View>
          <View style={[t.styles.inline, { alignItems: "flex-start", gap: 8, paddingHorizontal: 4 }]}>
            <Lock size={14} color={t.colors.faint} strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={[t.styles.small, { flex: 1, fontSize: 12 }]}>
              Customer messages stay hidden on your lock screen. Being on call
              doesn’t show you as online.
            </Text>
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <SectionLabel title="Workspaces" t={t} />
          <View style={t.styles.group}>
            {me.projects.map((project, index) => (
              <React.Fragment key={project.id}>
                {index > 0 && <View style={t.styles.divider} />}
                <SettingsRow
                  title={project.name}
                  onPress={() => onProject(project.id)}
                  end={
                    project.id === projectId ? (
                      <Check size={20} color={t.colors.text} />
                    ) : (
                      <ChevronRight size={18} color={t.colors.faint} />
                    )
                  }
                  t={t}
                />
              </React.Fragment>
            ))}
            <View style={t.styles.divider} />
            <SettingsRow
              title="Refresh workspaces"
              icon={RotateCw}
              onPress={() => void onRefresh().catch((e) => setError(describe(e)))}
              end={<View />}
              t={t}
            />
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <SectionLabel title="Server" t={t} />
          <View style={t.styles.group}>
            <SettingsRow
              title={api.baseUrl.replace(/^https?:\/\//, "")}
              subtitle="Your Upstep server"
              icon={Globe}
              onPress={onChangeServer}
              t={t}
            />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <View style={t.styles.group}>
            <SettingsRow
              title={busy ? "Signing out…" : "Sign out on this phone"}
              icon={LogOut}
              destructive
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void api.signOut().catch((e) => {
                  setError(`Could not revoke this phone’s session. ${describe(e)}`);
                  setBusy(false);
                });
              }}
              end={<View />}
              t={t}
            />
          </View>
          <Text style={[t.styles.small, { textAlign: "center", fontSize: 12 }]}>
            Signing out stops customer alerts on this phone.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
