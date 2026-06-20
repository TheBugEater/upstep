import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import type {
  Feedback,
  FeedbackType,
  FeedbackWithComments,
  UpstepConfig,
  VoteValue,
} from "@upstep/types";
import { UpstepApiClient } from "./api";

// Enable LayoutAnimation on Android
if (Platform.OS === "android") {
  const um = UIManager as unknown as { setLayoutAnimationEnabledExperimental?: (v: boolean) => void };
  um.setLayoutAnimationEnabledExperimental?.(true);
}

const DEFAULT_ACCENT = "#D97757";

interface UpstepContextValue {
  client: UpstepApiClient;
  feedItems: Feedback[];
  feedLoading: boolean;
  loadFeed: () => Promise<void>;
  submit: (title: string, content: string, type?: FeedbackType) => Promise<void>;
  vote: (feedbackId: string, value: VoteValue) => Promise<void>;
  getItem: (feedbackId: string) => Promise<FeedbackWithComments>;
  isOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  identify: (userId: string | undefined) => void;
  accentColor: string;
  theme: "light" | "dark" | "auto";
}

const UpstepContext = createContext<UpstepContextValue | null>(null);

export function FeedbackProvider({
  children,
  ...config
}: UpstepConfig & { children: ReactNode }) {
  const [client] = useState(() => new UpstepApiClient(config));
  const [feedItems, setFeedItems] = useState<Feedback[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    client.setUserId(config.userId);
  }, [client, config.userId]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const data = await client.listFeedback({ sort: "votes", limit: 30 });
      setFeedItems(data.items);
    } catch {
      // non-critical
    } finally {
      setFeedLoading(false);
    }
  }, [client]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  const submit = useCallback(
    async (title: string, content: string, type?: FeedbackType) => {
      const payload: Parameters<typeof client.submitFeedback>[0] = { content };
      if (title.trim()) payload.title = title.trim();
      if (type !== undefined) payload.type = type;
      await client.submitFeedback(payload);
      await loadFeed();
    },
    [client, loadFeed]
  );

  const vote = useCallback(async (feedbackId: string, value: VoteValue) => {
    // Capture snapshot for rollback, then animate into new sorted position
    let snapshot: Feedback[] = [];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFeedItems((prev) => {
      snapshot = prev;
      const updated = prev.map((f) => {
        if (f.id !== feedbackId) return f;
        const wasVoted = f.userVote === "UP";
        return {
          ...f,
          upvotes: wasVoted ? f.upvotes - 1 : f.upvotes + 1,
          userVote: wasVoted ? null : ("UP" as VoteValue),
        };
      });
      return [...updated].sort((a, b) => b.upvotes - a.upvotes);
    });

    try {
      await client.vote(feedbackId, value);
    } catch {
      // API failed — animate back to original order
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFeedItems(snapshot);
    }
  }, [client]);

  const getItem = useCallback(
    (feedbackId: string) => client.getItem(feedbackId),
    [client]
  );

  const openSheet = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsOpen(false);
  }, []);

  const identify = useCallback(
    (userId: string | undefined) => client.setUserId(userId),
    [client]
  );

  return (
    <UpstepContext.Provider
      value={{
        client, feedItems, feedLoading, loadFeed, submit, vote, getItem,
        isOpen, openSheet, closeSheet, identify,
        accentColor: config.accentColor ?? DEFAULT_ACCENT,
        theme: config.theme ?? "auto",
      }}
    >
      {children}
    </UpstepContext.Provider>
  );
}

export function useUpstep(): UpstepContextValue {
  const ctx = useContext(UpstepContext);
  if (!ctx) throw new Error("useUpstep must be used inside <FeedbackProvider>");
  return ctx;
}
