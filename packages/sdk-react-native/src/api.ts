import type {
  Feedback,
  FeedbackListResponse,
  FeedbackWithComments,
  SubmitFeedbackPayload,
  UpstepConfig,
  VoteValue,
} from "@upstep/types";

export class UpstepApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  userId: string | undefined;

  constructor(config: UpstepConfig) {
    this.baseUrl = (config.baseUrl ?? "https://upstep.io").replace(/\/$/, "");
    this.apiKey = config.apiKey;
    if (config.userId !== undefined) this.userId = config.userId;
  }

  /** Update the end-user id at runtime (e.g. after the user logs in). */
  setUserId(userId: string | undefined) {
    this.userId = userId;
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", "x-api-key": this.apiKey };
  }

  async listFeedback(params?: { cursor?: string; limit?: number; sort?: "date" | "votes" }): Promise<FeedbackListResponse> {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.sort) qs.set("sort", params.sort);
    // Pass userId so the server can include the user's own pending items.
    if (this.userId) qs.set("endUserId", this.userId);
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback?${qs}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackListResponse>;
  }

  async getItem(feedbackId: string): Promise<FeedbackWithComments> {
    const qs = this.userId ? `?endUserId=${encodeURIComponent(this.userId)}` : "";
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback/${feedbackId}${qs}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<FeedbackWithComments>;
  }

  async submitFeedback(payload: SubmitFeedbackPayload): Promise<Feedback> {
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ ...payload, endUserId: payload.endUserId ?? this.userId }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<Feedback>;
  }

  async vote(feedbackId: string, value: VoteValue): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ value, endUserId: this.userId }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }
}
