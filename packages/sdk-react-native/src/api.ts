import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Feedback,
  FeedbackListResponse,
  FeedbackWithComments,
  SubmitFeedbackPayload,
  UpstepConfig,
  VoteValue,
} from "@upstep/types";

const ANON_ID_KEY = "upstep-anonymous-id";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export class UpstepApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  userId: string | undefined;
  // Set synchronously to a throwaway id so there's always something to send;
  // swapped for the persisted value (or backfilled into storage) once
  // AsyncStorage resolves. Callers await anonymousIdReady first so requests
  // always go out with the id that's actually persisted.
  anonymousId: string;
  private readonly anonymousIdReady: Promise<void>;

  constructor(config: UpstepConfig) {
    this.baseUrl = (config.baseUrl ?? "https://upstep.dev").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    if (config.userId !== undefined) this.userId = config.userId;
    this.anonymousId = generateId();
    this.anonymousIdReady = this.loadAnonymousId();
  }

  private async loadAnonymousId(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(ANON_ID_KEY);
      if (stored) {
        this.anonymousId = stored;
      } else {
        await AsyncStorage.setItem(ANON_ID_KEY, this.anonymousId);
      }
    } catch {
      // storage unavailable - keep the in-memory id for this session
    }
  }

  /** Update the end-user id at runtime (e.g. after the user logs in). */
  setUserId(userId: string | undefined) {
    this.userId = userId;
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "x-api-key": this.apiKey };
  }

  async listFeedback(params?: { cursor?: string; limit?: number; sort?: "date" | "votes" }): Promise<FeedbackListResponse> {
    await this.anonymousIdReady;
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.sort) qs.set("sort", params.sort);
    // Pass userId so the server can include the user's own pending items.
    if (this.userId) qs.set("endUserId", this.userId);
    qs.set("anonymousId", this.anonymousId);
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback?${qs}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackListResponse>;
  }

  async getItem(feedbackId: string): Promise<FeedbackWithComments> {
    await this.anonymousIdReady;
    const qs = new URLSearchParams();
    if (this.userId) qs.set("endUserId", this.userId);
    qs.set("anonymousId", this.anonymousId);
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback/${feedbackId}?${qs}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackWithComments>;
  }

  async submitFeedback(payload: SubmitFeedbackPayload): Promise<Feedback> {
    await this.anonymousIdReady;
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

  async vote(feedbackId: string, value: VoteValue): Promise<void> {
    await this.anonymousIdReady;
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ value, endUserId: this.userId, anonymousId: this.anonymousId }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }
}
