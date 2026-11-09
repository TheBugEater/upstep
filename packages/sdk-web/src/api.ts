import type {
  Feedback,
  FeedbackListResponse,
  FeedbackWithComments,
  SubmitFeedbackPayload,
  VotePayload,
  UpstepConfig,
} from "@upstep/types";

const ANON_ID_KEY = "upstep-anonymous-id";

/** Reads (or generates and persists) a stable per-browser anonymous id, so
 *  votes/submissions can be deduped even before identify() is called. Falls
 *  back to a session-only id when storage is unavailable (private browsing,
 *  disabled cookies, SSR). */
function getOrCreateAnonymousId(): string | undefined {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

  if (typeof window === "undefined") return id;
  try {
    const existing = window.localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    window.localStorage.setItem(ANON_ID_KEY, id);
    return id;
  } catch {
    return id;
  }
}

/** Unread chat messages reported by the support chat while it is closed or scrolled away. */
export interface SupportUnread {
  count: number;
  /** True when this report was triggered by a message that just arrived. */
  newMessage: boolean;
  author: string;
  preview: string;
  /** Whether the customer wants a sound for new messages. */
  sound: boolean;
}

export class UpstepApiClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  userId: string | undefined;
  supportIdentityToken: string | undefined;
  chat: boolean;
  readonly anonymousId: string | undefined;

  constructor(config: UpstepConfig) {
    this.baseUrl = (config.baseUrl ?? "https://upstep.dev").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.supportIdentityToken = config.supportIdentityToken;
    this.chat = config.chat !== false;
    if (config.userId !== undefined) this.userId = config.userId;
    this.anonymousId = getOrCreateAnonymousId();
  }

  /** Update the end-user id at runtime (e.g. after the user logs in). */
  setUserId(userId: string | undefined) {
    this.userId = userId;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  async supportEnabled(): Promise<boolean> {
    if (!this.chat) return false;
    try {
      const response = await fetch(`${this.baseUrl}/api/sdk/support`, {
        headers: this.headers(),
      });
      return response.ok && (await response.json()).enabled === true;
    } catch {
      return false;
    }
  }

  supportFrameUrl(theme: string, accentColor = "#D97757"): string {
    return `${this.baseUrl}/support/${encodeURIComponent(this.apiKey)}?theme=${encodeURIComponent(theme)}&accent=${encodeURIComponent(accentColor)}`;
  }

  connectSupportFrame(
    frame: HTMLIFrameElement,
    options: {
      /** Whether the chat is currently on screen. Lets the chat know when messages are unseen. */
      isVisible?: () => boolean;
      onUnread?: (unread: SupportUnread) => void;
    } = {},
  ) {
    const target = new URL(this.baseUrl).origin;
    const send = () =>
      frame.contentWindow?.postMessage(
        {
          type: "upstep:support:identity",
          token: this.supportIdentityToken,
          accentColor: getComputedStyle(frame).color,
          ...(options.isVisible ? { visible: options.isVisible() } : {}),
        },
        target,
      );
    const receive = (event: MessageEvent) => {
      if (event.origin !== target || event.source !== frame.contentWindow)
        return;
      const data = event.data as Record<string, unknown> | null;
      if (data?.type === "upstep:support:ready") send();
      else if (data?.type === "upstep:support:unread" && options.onUnread) {
        const count = Number(data["count"]);
        options.onUnread({
          count: Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
          newMessage: data["newMessage"] === true,
          author: String(data["author"] ?? "").slice(0, 80),
          preview: String(data["preview"] ?? "").slice(0, 200),
          sound: data["sound"] !== false,
        });
      }
    };
    frame.addEventListener("load", send);
    window.addEventListener("message", receive);
    return () => {
      frame.removeEventListener("load", send);
      window.removeEventListener("message", receive);
    };
  }

  /** Tell the chat whether it is on screen so it can track unread messages. */
  notifySupportVisibility(frame: HTMLIFrameElement, visible: boolean) {
    frame.contentWindow?.postMessage(
      { type: "upstep:support:visible", visible },
      new URL(this.baseUrl).origin,
    );
  }

  async listFeedback(params?: {
    cursor?: string;
    limit?: number;
    type?: string;
    status?: string;
    sort?: "date" | "votes";
  }): Promise<FeedbackListResponse> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.type) qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    if (params?.sort) qs.set("sort", params.sort);
    // Pass userId so the server can include the user's own pending items.
    if (this.userId) qs.set("endUserId", this.userId);
    if (this.anonymousId) qs.set("anonymousId", this.anonymousId);

    const res = await fetch(`${this.baseUrl}/api/sdk/feedback?${qs}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackListResponse>;
  }

  async submitFeedback(payload: SubmitFeedbackPayload): Promise<Feedback> {
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        ...payload,
        endUserId: payload.endUserId ?? this.userId,
        anonymousId: payload.anonymousId ?? this.anonymousId,
      }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<Feedback>;
  }

  async vote(feedbackId: string, value: VotePayload["value"]): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          value,
          endUserId: this.userId,
          anonymousId: this.anonymousId,
        }),
      },
    );
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }

  async getItem(feedbackId: string): Promise<FeedbackWithComments> {
    const qs = new URLSearchParams();
    if (this.userId) qs.set("endUserId", this.userId);
    if (this.anonymousId) qs.set("anonymousId", this.anonymousId);
    const res = await fetch(
      `${this.baseUrl}/api/sdk/feedback/${feedbackId}?${qs}`,
      {
        headers: this.headers(),
      },
    );
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackWithComments>;
  }

  async removeVote(feedbackId: string): Promise<void> {
    if (!this.userId && !this.anonymousId) return;
    const qs = new URLSearchParams();
    if (this.userId) qs.set("endUserId", this.userId);
    if (this.anonymousId) qs.set("anonymousId", this.anonymousId);
    const res = await fetch(
      `${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote?${qs}`,
      {
        method: "DELETE",
        headers: this.headers(),
      },
    );
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }
}
