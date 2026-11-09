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

/** The dashboard column assigned to a feedback item, when custom statuses are enabled. */
export interface BoardStatus {
  id: string;
  name: string;
  color: string;
  isDone: boolean;
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
  anonymousId: string | null;
  upvotes: number;
  downvotes: number;
  /** Auto-flagged by the profanity filter on submit. */
  flagged?: boolean;
  /** Dev-only — hidden from the public SDK widget. */
  internal?: boolean;
  labels?: Label[];
  /** Custom dashboard column. Prefer its name and color when displaying status. */
  boardStatus?: BoardStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  /** The current user's vote, if any — populated by the API when userId is known. */
  userVote?: VoteValue | null;
}

/** A team comment left on a feedback item. */
export interface Comment {
  id: string;
  feedbackId: string;
  content: string;
  /** Display name of the commenter. */
  authorName: string | null;
  authorId?: string | null;
  parentId?: string | null;
  author?: { id: string; name: string | null; image: string | null } | null;
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
  anonymousId: string | null;
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
  /** Server-signed customer identity JWT for private support conversations. */
  supportIdentityToken?: string;
  /**
   * React Native: called when a support reply arrives while the chat is closed.
   * Use it to play a sound or raise a local notification. The SDK itself vibrates briefly.
   */
  onSupportMessage?: (message: {
    author: string;
    preview: string;
    count: number;
  }) => void;
  /** Show chat inside the existing widget when enabled for the project. Defaults to true. */
  chat?: boolean;
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
  /** @deprecated Website launchers and panels are always anchored bottom-right. */
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
  /** Client-persisted anonymous visitor id, sent automatically when identify() hasn't been called. */
  anonymousId?: string;
  metadata?: Record<string, unknown>;
}

export interface VotePayload {
  value: VoteValue;
  endUserId?: string;
  /** Client-persisted anonymous visitor id, sent automatically when identify() hasn't been called. */
  anonymousId?: string;
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

// Shared support protocol used by the web and native widgets.
export type SupportWidget =
 | {id:string;type:"quick_replies"|"confirmation";title:string;options:string[]}
 | {id:string;type:"issue_details";title:string}
 | {id:string;type:"contact_form";title:string;summary:string};
export interface SupportMessage {
 id:string; role:"CUSTOMER"|"ASSISTANT"|"AGENT"|"SYSTEM";authorName:string;content:string;createdAt?:string;
 metadata?:{citations?:{url:string;title:string}[];widgets?:SupportWidget[];inScope?:boolean;ticketReference?:string};
}
export interface SupportConversation {
 id:string;state:string;ticketId:string|null;ticketReference:string|null;supportEmail:string|null;aiPending:boolean;
 canEscalate:boolean;escalationSummary:string|null;activeWidgetMessageId:string|null;humanRequested:boolean;
 messages:SupportMessage[];customer:{name:string|null;email:string|null;verified:boolean};
}
export interface SupportConfiguration {enabled:boolean;businessName:string;logoUrl?:string|null;welcomeMessage:string;mode:string;showBranding?:boolean;online:{name:string}[]}
