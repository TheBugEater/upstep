import type {
  Feedback,
  FeedbackListResponse,
  SubmitFeedbackPayload,
  VotePayload,
  UpstepConfig,
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

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
    };
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
      }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
    return res.json() as Promise<Feedback>;
  }

  async vote(feedbackId: string, value: VotePayload["value"]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ value, endUserId: this.userId }),
    });
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }

  async removeVote(feedbackId: string): Promise<void> {
    if (!this.userId) return;
    const res = await fetch(
      `${this.baseUrl}/api/sdk/feedback/${feedbackId}/vote?endUserId=${encodeURIComponent(this.userId)}`,
      { method: "DELETE", headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Upstep: ${res.status}`);
  }
}
