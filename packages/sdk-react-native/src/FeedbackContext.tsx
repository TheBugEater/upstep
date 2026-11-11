import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  AppState,
  LayoutAnimation,
  Platform,
  UIManager,
  Vibration,
} from "react-native";
import type {
  Feedback,
  FeedbackType,
  FeedbackWithComments,
  UpstepConfig,
  VoteValue,
  SupportConfiguration,
} from "@upstep/types";
import { UpstepApiClient } from "./api";
import { RadiusContext, clampRadius } from "./theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android") {
  const um = UIManager as unknown as {
    setLayoutAnimationEnabledExperimental?: (v: boolean) => void;
  };
  um.setLayoutAnimationEnabledExperimental?.(true);
}

const DEFAULT_ACCENT = "#D97757";

interface UpstepContextValue {
  client: UpstepApiClient;
  feedItems: Feedback[];
  feedLoading: boolean;
  loadFeed: () => Promise<void>;
  submit: (
    title: string,
    content: string,
    type?: FeedbackType,
  ) => Promise<void>;
  vote: (feedbackId: string, value: VoteValue) => Promise<void>;
  getItem: (feedbackId: string) => Promise<FeedbackWithComments>;
  isOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  identify: (userId: string | undefined) => void;
  accentColor: string;
  theme: "light" | "dark" | "auto";
  /** Panel color overrides from the provider config. */
  colors: UpstepConfig["colors"];
  /** Base corner radius in px, clamped to 0–32. */
  radius: number;
  showBranding: boolean;
  supportConfig: SupportConfiguration | null;
  supportRevision: number;
  /** Unread support replies while the chat is closed. Use it to badge your own launcher. */
  supportUnread: number;
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
  const [supportConfig, setSupportConfig] =
    useState<SupportConfiguration | null>(null);
  const [supportRevision, setSupportRevision] = useState(0);
  const [showBranding, setShowBranding] = useState(true);
  const [supportUnread, setSupportUnread] = useState(0);
  const previousUnread = useRef(0);
  const isOpenRef = useRef(false);
  const onSupportMessage = useRef(config.onSupportMessage);
  onSupportMessage.current = config.onSupportMessage;
  isOpenRef.current = isOpen;

  const checkSupport = useCallback(async () => {
    try {
      const unread = await client.support.unread();
      if (isOpenRef.current) return;
      setSupportUnread(unread.count);
      if (unread.count > previousUnread.current && unread.latest) {
        if (await client.support.soundEnabled()) Vibration.vibrate(40);
        onSupportMessage.current?.({
          author: unread.latest.author,
          preview: unread.latest.preview,
          count: unread.count,
        });
      }
      previousUnread.current = unread.count;
    } catch {
      // checking for replies is best effort
    }
  }, [client]);

  // While the chat is closed, look for replies so the launcher can show a count.
  useEffect(() => {
    if (!supportConfig?.enabled) return;
    if (isOpen) {
      previousUnread.current = 0;
      setSupportUnread(0);
      return;
    }
    void checkSupport();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void checkSupport();
    }, 20000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkSupport();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [supportConfig?.enabled, isOpen, supportRevision, checkSupport]);

  useEffect(() => {
    client.setUserId(config.userId);
  }, [client, config.userId]);

  useEffect(() => {
    let active = true;
    void client.support.identify(config.supportIdentityToken).then(() => {
      if (active) setSupportRevision((v) => v + 1);
    });
    if (config.chat === false) {
      setSupportConfig(null);
      return () => {
        active = false;
      };
    }
    void client.support
      .configuration()
      .then((value) => {
        if (active) setSupportConfig(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [client, config.chat, config.supportIdentityToken]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const data = await client.listFeedback({ sort: "votes", limit: 30 });
      setFeedItems(data.items);
      setShowBranding(data.showBranding ?? true);
    } catch {
      // non-critical
    } finally {
      setFeedLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const submit = useCallback(
    async (title: string, content: string, type?: FeedbackType) => {
      const payload: Parameters<typeof client.submitFeedback>[0] = { content };
      if (title.trim()) payload.title = title.trim();
      if (type !== undefined) payload.type = type;
      await client.submitFeedback(payload);
      await loadFeed();
    },
    [client, loadFeed],
  );

  const vote = useCallback(
    async (feedbackId: string, value: VoteValue) => {
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
    },
    [client],
  );

  const getItem = useCallback(
    (feedbackId: string) => client.getItem(feedbackId),
    [client],
  );

  const openSheet = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsOpen(false);
  }, []);

  const identify = useCallback(
    (userId: string | undefined) => client.setUserId(userId),
    [client],
  );

  return (
    <UpstepContext.Provider
      value={{
        client,
        feedItems,
        feedLoading,
        loadFeed,
        submit,
        vote,
        getItem,
        isOpen,
        openSheet,
        closeSheet,
        identify,
        accentColor: config.accentColor ?? DEFAULT_ACCENT,
        theme: config.theme ?? "auto",
        colors: config.colors,
        radius: clampRadius(config.radius),
        showBranding,
        supportConfig,
        supportRevision,
        supportUnread,
      }}
    >
      <RadiusContext.Provider value={clampRadius(config.radius)}>
        {children}
      </RadiusContext.Provider>
    </UpstepContext.Provider>
  );
}

export function useUpstep(): UpstepContextValue {
  const ctx = useContext(UpstepContext);
  if (!ctx) throw new Error("useUpstep must be used inside <FeedbackProvider>");
  return ctx;
}
