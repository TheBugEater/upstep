import React, { useState, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  ActivityIndicator,
  useColorScheme,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Comment, Feedback, FeedbackType, FeedbackWithComments } from "@upstep/types";
import { useUpstep } from "./FeedbackContext";

// ─── Theme ────────────────────────────────────────────────────────────────────

interface Palette {
  bg: string;
  bgSoft: string;
  text: string;
  textSoft: string;
  textFaint: string;
  border: string;
  handle: string;
}

const LIGHT: Palette = {
  bg: "#ffffff",
  bgSoft: "#f6f5f2",
  text: "#1a1915",
  textSoft: "#56544d",
  textFaint: "#9b9890",
  border: "#e8e6df",
  handle: "#dad7ce",
};

const DARK: Palette = {
  bg: "#1c1b19",
  bgSoft: "#262522",
  text: "#f5f4f0",
  textSoft: "#b4b1a8",
  textFaint: "#7d7a72",
  border: "#33312c",
  handle: "#48453f",
};

// ─── Navigation ───────────────────────────────────────────────────────────────

type Nav =
  | { screen: "list" }
  | { screen: "detail"; feedbackId: string }
  | { screen: "create" };

// ─── FeedbackSheet ────────────────────────────────────────────────────────────

export function FeedbackSheet() {
  const { isOpen, closeSheet, accentColor, theme, loadFeed, showBranding } = useUpstep();
  const scheme = useColorScheme();
  const isDark = theme === "dark" || (theme === "auto" && scheme === "dark");
  const p = isDark ? DARK : LIGHT;

  const [nav, setNav] = useState<Nav>({ screen: "list" });
  const [listTab, setListTab] = useState<"open" | "done">("open");
  const insets = useSafeAreaInsets();

  // Refresh list every time the modal opens
  useEffect(() => {
    if (isOpen) loadFeed();
  }, [isOpen, loadFeed]);

  function handleClose() {
    closeSheet();
    // Reset to list when closed so next open starts fresh
    setTimeout(() => setNav({ screen: "list" }), 300);
  }

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Tap backdrop to dismiss */}
        <Pressable style={styles.backdrop} onPress={handleClose} />

        {/* Sheet */}
        <View style={[styles.sheet, { backgroundColor: p.bg }]}>
          {/* Drag handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: p.handle }]} />
          </View>

          {/* Fixed header */}
          <View style={[styles.header, { borderBottomColor: p.border }]}>
            {nav.screen === "list" ? (
              <>
                <Text style={[styles.headerTitle, { color: p.text }]}>Feedback</Text>
                <TouchableOpacity
                  onPress={() => setNav({ screen: "create" })}
                  activeOpacity={0.8}
                  style={[styles.newBtn, { backgroundColor: accentColor }]}
                >
                  <Text style={styles.newBtnText}>+ New</Text>
                </TouchableOpacity>
              </>
            ) : nav.screen === "create" ? (
              <>
                <TouchableOpacity
                  onPress={() => setNav({ screen: "list" })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 16 }}
                >
                  <Text style={[styles.navBtn, { color: accentColor }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: p.text }]}>New feedback</Text>
                <View style={styles.navBtnSpacer} />
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setNav({ screen: "list" })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 16 }}
              >
                <Text style={[styles.navBtn, { color: accentColor }]}>← Back</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Open / Completed tabs — only on list screen */}
          {nav.screen === "list" && (
            <View style={[styles.listTabBar, { borderBottomColor: p.border }]}>
              <TouchableOpacity
                onPress={() => setListTab("open")}
                style={[styles.listTabBtn, listTab === "open" && { borderBottomColor: accentColor }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.listTabText, { color: listTab === "open" ? accentColor : p.textFaint }]}>
                  Open
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setListTab("done")}
                style={[styles.listTabBtn, listTab === "done" && { borderBottomColor: accentColor }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.listTabText, { color: listTab === "done" ? accentColor : p.textFaint }]}>
                  Completed
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scrollable body */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {nav.screen === "list" && (
              <FeedListBody
                p={p}
                accent={accentColor}
                tab={listTab}
                onSelect={(id) => setNav({ screen: "detail", feedbackId: id })}
              />
            )}
            {nav.screen === "detail" && "feedbackId" in nav && (
              <FeedDetailBody
                p={p}
                accent={accentColor}
                feedbackId={(nav as { screen: "detail"; feedbackId: string }).feedbackId}
              />
            )}
            {nav.screen === "create" && (
              <FeedCreateBody
                p={p}
                accent={accentColor}
                onDone={() => {
                  setNav({ screen: "list" });
                }}
              />
            )}
          </ScrollView>

          {/* Branding — hidden for Business plan */}
          {showBranding && (
            <TouchableOpacity
              onPress={() => Linking.openURL("https://upstep.dev")}
              activeOpacity={0.6}
              style={[
                styles.poweredBy,
                { borderTopColor: p.border, paddingBottom: insets.bottom + 10, backgroundColor: p.bg },
              ]}
            >
              <Text style={[styles.poweredByText, { color: p.textFaint }]}>
                Powered by <Text style={{ fontWeight: "700" }}>Upstep.dev</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── FeedListBody ─────────────────────────────────────────────────────────────

function FeedListBody({
  p, accent, tab, onSelect,
}: {
  p: Palette; accent: string; tab: "open" | "done"; onSelect: (id: string) => void;
}) {
  const { feedItems, feedLoading, vote } = useUpstep();

  const displayItems = tab === "done"
    ? feedItems.filter((f) => f.status === "DONE")
    : feedItems.filter((f) => f.status === "OPEN" || f.status === "IN_PROGRESS" || f.status === "PENDING");

  if (feedLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  if (displayItems.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: p.textFaint }]}>
          {tab === "done"
            ? "No completed items yet."
            : "No open feedback yet. Be the first to add one."}
        </Text>
      </View>
    );
  }

  return (
    <>
      {displayItems.map((f) => (
        <FeedCard
          key={f.id}
          item={f}
          p={p}
          accent={accent}
          onPress={() => onSelect(f.id)}
          onVote={() => vote(f.id, "UP")}
        />
      ))}
    </>
  );
}

function FeedCard({
  item, p, accent, onPress, onVote,
}: {
  item: Feedback; p: Palette; accent: string;
  onPress: () => void; onVote: () => void;
}) {
  const voted = item.userVote === "UP";
  const displayTitle = item.title ?? item.content;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, { borderColor: p.border, backgroundColor: p.bg }]}
    >
      <TouchableOpacity
        onPress={onVote}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        style={[
          styles.voteBox,
          {
            borderColor: voted ? accent : p.border,
            backgroundColor: voted ? accent : p.bgSoft,
          },
        ]}
      >
        <Text style={[styles.voteArrow, { color: voted ? "#fff" : accent }]}>▲</Text>
        <Text style={[styles.voteCount, { color: voted ? "#fff" : p.text }]}>{item.upvotes}</Text>
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: p.text }]} numberOfLines={2}>
          {displayTitle}
        </Text>
        {item.title && (
          <Text style={[styles.cardDesc, { color: p.textFaint }]} numberOfLines={1}>
            {item.content}
          </Text>
        )}
        <View style={styles.cardMeta}>
          <TypeBadge type={item.type} p={p} />
          {item.status === "PENDING"
            ? <PendingBadge />
            : <StatusDot status={item.status} />}
          <Text style={[styles.cardDate, { color: p.textFaint }]}>{fmtDate(item.createdAt)}</Text>
        </View>
      </View>

      <Text style={[styles.chevron, { color: p.textFaint }]}>›</Text>
    </TouchableOpacity>
  );
}

// ─── FeedDetailBody ───────────────────────────────────────────────────────────

function FeedDetailBody({
  p, accent, feedbackId,
}: {
  p: Palette; accent: string; feedbackId: string;
}) {
  const { vote, getItem } = useUpstep();
  const [item, setItem] = useState<FeedbackWithComments | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getItem(feedbackId)
      .then((data) => { if (!cancelled) { setItem(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [feedbackId, getItem]);

  async function handleVote() {
    if (!item || voting) return;
    setVoting(true);
    try {
      await vote(item.id, "UP");
      const updated = await getItem(feedbackId);
      setItem(updated);
    } finally {
      setVoting(false);
    }
  }

  if (loading || !item) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  return (
    <View style={styles.detailPad}>
      {item.title && (
        <Text style={[styles.detailTitle, { color: p.text }]}>{item.title}</Text>
      )}
      <View style={styles.badgeRow}>
        <TypeBadge type={item.type} p={p} />
        {item.status === "PENDING"
          ? <PendingBadge />
          : <StatusBadge status={item.status} p={p} />}
      </View>

      <Text style={[styles.detailContent, { color: p.textSoft }]}>{item.content}</Text>

      <TouchableOpacity
        onPress={handleVote}
        disabled={voting}
        activeOpacity={0.8}
        style={[
          styles.upvoteBtn,
          {
            borderColor: item.userVote === "UP" ? accent : p.border,
            backgroundColor: item.userVote === "UP" ? accent + "15" : p.bgSoft,
          },
        ]}
      >
        {voting ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <>
            <Text style={[styles.upvoteArrow, { color: accent }]}>▲</Text>
            <Text style={[styles.upvoteCount, { color: p.text }]}>{item.upvotes}</Text>
            <Text style={[styles.upvoteLabel, { color: p.textFaint }]}>
              {item.userVote === "UP" ? "Upvoted" : "Upvote"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {item.comments.length > 0 && (
        <View style={[styles.commentsSection, { borderTopColor: p.border }]}>
          <Text style={[styles.commentsLabel, { color: p.textFaint }]}>DEVELOPER RESPONSE</Text>
          {item.comments.map((c) => (
            <CommentBubble key={c.id} comment={c} p={p} accent={accent} />
          ))}
        </View>
      )}
    </View>
  );
}

function CommentBubble({ comment, p, accent }: { comment: Comment; p: Palette; accent: string }) {
  return (
    <View style={[styles.commentBubble, { backgroundColor: p.bgSoft, borderColor: p.border }]}>
      <View style={styles.commentMeta}>
        <View style={[styles.ownerBadge, { backgroundColor: accent + "20" }]}>
          <Text style={[styles.ownerBadgeText, { color: accent }]}>
            Developer
          </Text>
        </View>
        <Text style={[styles.commentDate, { color: p.textFaint }]}>{fmtDate(comment.createdAt)}</Text>
      </View>
      <Text style={[styles.commentContent, { color: p.textSoft }]}>{comment.content}</Text>
    </View>
  );
}

// ─── FeedCreateBody ───────────────────────────────────────────────────────────

const TYPES: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
const TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: "Bug report",
  FEATURE: "Feature request",
  GENERAL: "General",
};

function FeedCreateBody({
  p, accent, onDone,
}: {
  p: Palette; accent: string; onDone: () => void;
}) {
  const { submit } = useUpstep();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FeedbackType>("GENERAL");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await submit(title.trim(), description.trim() || title.trim(), type);
      setSuccess(true);
      setTimeout(onDone, 1200);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.centered, { paddingTop: 40 }]}>
        <Text style={[styles.successTitle, { color: p.text }]}>Submitted</Text>
        <Text style={[styles.successSub, { color: p.textFaint }]}>
          Thanks — we received your feedback.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.createPad}>
      <Text style={[styles.fieldLabel, { color: p.textFaint }]}>TYPE</Text>
      <View style={styles.typeRow}>
        {TYPES.map((t) => {
          const active = type === t;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setType(t)}
              activeOpacity={0.8}
              style={[
                styles.typeBtn,
                {
                  borderColor: active ? accent : p.border,
                  backgroundColor: active ? accent : p.bg,
                },
              ]}
            >
              <Text style={[styles.typeBtnText, { color: active ? "#fff" : p.textSoft }]}>
                {TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.fieldLabel, { color: p.textFaint }]}>TITLE</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Short summary of the issue or idea"
        placeholderTextColor={p.textFaint}
        maxLength={200}
        returnKeyType="next"
        style={[styles.titleInput, { borderColor: p.border, backgroundColor: p.bgSoft, color: p.text }]}
      />

      <Text style={[styles.fieldLabel, { color: p.textFaint }]}>DESCRIPTION</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Steps to reproduce, expected behaviour, or more context (optional)"
        placeholderTextColor={p.textFaint}
        multiline
        numberOfLines={5}
        maxLength={2000}
        textAlignVertical="top"
        style={[styles.descInput, { borderColor: p.border, backgroundColor: p.bgSoft, color: p.text }]}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting || !title.trim()}
        activeOpacity={0.85}
        style={[
          styles.submitBtn,
          { backgroundColor: accent },
          (submitting || !title.trim()) && styles.submitBtnDisabled,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Submit feedback</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

const TYPE_BG: Record<FeedbackType, string> = {
  BUG: "#fdecec", FEATURE: "#e9f0fd", GENERAL: "",
};
const TYPE_FG: Record<FeedbackType, string> = {
  BUG: "#d6453d", FEATURE: "#3b76d6", GENERAL: "",
};

function PendingBadge() {
  return (
    <View style={styles.pendingBadge}>
      <View style={styles.pendingDot} />
      <Text style={styles.pendingBadgeText}>Pending review</Text>
    </View>
  );
}

function TypeBadge({ type, p }: { type: FeedbackType; p: Palette }) {
  return (
    <View style={[styles.badge, { backgroundColor: TYPE_BG[type] || p.bgSoft }]}>
      <Text style={[styles.badgeText, { color: TYPE_FG[type] || p.textSoft }]}>{type}</Text>
    </View>
  );
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: "#b45309", IN_PROGRESS: "#1d4ed8", DONE: "#15803d",
  PENDING: "#ea580c", CLOSED: "#6b7280",
};

function StatusDot({ status }: { status: string }) {
  return <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[status] ?? "#9ca3af" }]} />;
}

function StatusBadge({ status, p }: { status: string; p: Palette }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: p.bgSoft, borderColor: p.border }]}>
      <StatusDot status={status} />
      <Text style={[styles.statusBadgeText, { color: p.textSoft }]}>{status.replace("_", " ")}</Text>
    </View>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Modal overlay
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  // Sheet container — fixed height so it's always fully open regardless of content
  sheet: {
    height: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.3 },
  navBtn: { fontSize: 14, fontWeight: "600" },
  navBtnSpacer: { width: 60 },
  newBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  newBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // List tab bar
  listTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listTabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  listTabText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Scroll — flex: 1 fills all remaining space after the fixed header
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 16, paddingBottom: 32 },

  // List
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  voteBox: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
  },
  voteArrow: { fontSize: 11, lineHeight: 13 },
  voteCount: { fontSize: 15, fontWeight: "700", lineHeight: 18 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600", lineHeight: 19, marginBottom: 2 },
  cardDesc: { fontSize: 12.5, lineHeight: 17, marginBottom: 6 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardDate: { fontSize: 11 },
  chevron: { fontSize: 22, fontWeight: "300", marginLeft: 4 },

  // Detail
  detailPad: { paddingTop: 4 },
  detailTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginBottom: 10, lineHeight: 28 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  detailContent: { fontSize: 15, lineHeight: 23, marginBottom: 24 },
  upvoteBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "flex-start", borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8,
    minWidth: 80, justifyContent: "center",
  },
  upvoteArrow: { fontSize: 13, lineHeight: 15 },
  upvoteCount: { fontSize: 18, fontWeight: "700" },
  upvoteLabel: { fontSize: 13, fontWeight: "500" },
  commentsSection: { marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 20 },
  commentsLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 12 },
  commentBubble: {
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10,
  },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  ownerBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  ownerBadgeText: { fontSize: 11, fontWeight: "700" },
  commentDate: { fontSize: 11 },
  commentContent: { fontSize: 14, lineHeight: 21 },

  // Create
  createPad: { paddingTop: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  typeBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  titleInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 20,
    ...(Platform.OS === "ios" ? {} : { paddingTop: 12 }),
  },
  descInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, minHeight: 110, marginBottom: 20,
    ...(Platform.OS === "ios" ? {} : { paddingTop: 12 }),
  },
  errorText: { fontSize: 13, marginBottom: 12, fontWeight: "500", color: "#d6453d" },
  submitBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  successTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  successSub: { fontSize: 14, textAlign: "center" },

  // Pending badge
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ea580c",
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ea580c",
  },

  // Branding
  poweredBy: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  poweredByText: { fontSize: 11 },

  // Shared badges
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: StyleSheet.hairlineWidth,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
});
