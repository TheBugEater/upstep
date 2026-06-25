// ─── Enums ───────────────────────────────────────────────────────────────────

export type FeedbackType = "BUG" | "FEATURE" | "GENERAL";
export type FeedbackStatus = "PENDING" | "OPEN" | "IN_PROGRESS" | "DONE" | "CLOSED";
export type VoteValue = "UP" | "DOWN";

// ─── Core models ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  ownerId: string;
  createdAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Feedback {
  id: string;
  projectId: string;
  /** Optional short subject line (set by the RN widget; web widget omits it). */
  title?: string | null;
  content: string;
  type: FeedbackType;
  status: FeedbackStatus;
  endUserId: string | null;
  upvotes: number;
  downvotes: number;
  /** Auto-flagged by the profanity filter on submit. */
  flagged?: boolean;
  /** Dev-only — hidden from the public SDK widget. */
  internal?: boolean;
  labels?: Label[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  /** The current user's vote, if any — populated by the API when userId is known. */
  userVote?: VoteValue | null;
}

/** A developer comment left on a feedback item. */
export interface Comment {
  id: string;
  feedbackId: string;
  content: string;
  /** Display name of the commenter (project owner). */
  authorName: string | null;
  isOwner: boolean;
  createdAt: string;
}

/** Feedback item returned from the detail endpoint — includes developer comments. */
export interface FeedbackWithComments extends Feedback {
  comments: Comment[];
}

export interface Vote {
  id: string;
  feedbackId: string;
  value: VoteValue;
  endUserId: string | null;
  createdAt: string;
}

// ─── SDK init options ─────────────────────────────────────────────────────────

export interface UpstepConfig {
  apiKey: string;
  /**
   * Optional end-user ID from the host app — enables per-user vote
   * deduplication. If your user logs in after the widget mounts, call
   * `identify(userId)` (or pass a changing `userId` to the React provider)
   * instead of waiting — see the docs.
   */
  userId?: string;
  /** Base URL of your Upstep backend. Defaults to https://upstep.dev */
  baseUrl?: string;
  /**
   * Accent color for the widget button, tabs, and highlights.
   * Any CSS color string. Defaults to "#D97757".
   */
  accentColor?: string;
  /**
   * Color theme for the widget panel. "auto" follows the host OS / browser
   * `prefers-color-scheme`. Defaults to "auto".
   */
  theme?: "light" | "dark" | "auto";
  /** Launcher button position. Defaults to "right". */
  position?: "left" | "right";
  /**
   * Whether to render the floating launcher button (vanilla web widget).
   * Set to `false` to trigger the widget from your own UI via `Upstep.open()`.
   * Defaults to `true`.
   */
  launcher?: boolean;
}

// ─── API request / response shapes ───────────────────────────────────────────

export interface SubmitFeedbackPayload {
  /** Optional short title — used by the RN widget form. */
  title?: string;
  content: string;
  type?: FeedbackType;
  endUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface VotePayload {
  value: VoteValue;
  endUserId?: string;
}

export interface FeedbackListResponse {
  items: Feedback[];
  nextCursor: string | null;
  /** Whether the "Powered by Upstep" badge should be shown — false for Business plan. */
  showBranding: boolean;
}

export interface ApiError {
  error: string;
  status: number;
}
