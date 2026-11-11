import type { Feedback, FeedbackType } from "@upstep/types";
import type { UpstepColorOverrides } from "@upstep/types";
import { UpstepApiClient, type SupportUnread } from "./api";
import { buildWidgetPalette, scaleRadius, type WidgetPalette } from "./theme";

type ThemeMode = "light" | "dark" | "auto";

/** A host-supplied font-family, or "" when unset or unsafe to write into a CSS rule. */
function safeFontFamily(font: string | undefined): string {
  const value = font?.trim();
  return value && /^[\w\s,"'.-]{1,200}$/.test(value) ? value : "";
}

/** "auto" follows the host page's own theme (the `.dark` class / `data-theme`
 *  attribute convention most apps toggle on <html>, e.g. Tailwind's
 *  `darkMode: "class"`), not the OS-level prefers-color-scheme. Absence of
 *  that signal means light: it's a binary convention, and a page that uses
 *  it has already merged in the OS preference (usually at pre-paint) by the
 *  time this runs, so re-checking prefers-color-scheme independently here
 *  would just re-introduce the mismatch instead of resolving it. */
function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    return root.classList.contains("dark") ||
      root.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/** Builds the widget stylesheet from the resolved palette, radius and font. */
function buildStyles(p: WidgetPalette, font: string): string {
  const side = "right:24px;left:auto";
  const accent = p.accent;
  const on = p.accentText;
  const r = (designed: number) => `${scaleRadius(designed, p.radius)}px`;
  return `
#upstep-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}${font ? `\n#upstep-btn,#upstep-btn *,#upstep-backdrop,#upstep-backdrop *,#upstep-toast,#upstep-toast *{font-family:${font}}` : ""}
#upstep-btn{position:fixed;bottom:24px;${side};z-index:9998;display:inline-flex;align-items:center;gap:7px;background:${accent};color:${on};border:none;border-radius:${r(9999)};padding:12px 18px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(26,25,21,.18);transition:transform .15s,box-shadow .15s}
#upstep-btn svg{width:16px;height:16px;flex-shrink:0}
#upstep-btn:hover{transform:translateY(-1px);box-shadow:0 8px 26px rgba(26,25,21,.24)}
@media(max-width:639px){#upstep-btn{padding:12px}#upstep-btn span{display:none}}
@media(max-width:639px){#upstep-backdrop{padding:0 12px 80px!important}#upstep-modal{max-height:calc(100dvh - 104px)!important}}
#upstep-backdrop{position:fixed;inset:0;background:transparent;z-index:9999;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 24px 88px;animation:upstep-fade .2s ease}
@keyframes upstep-fade{from{opacity:0}to{opacity:1}}
@keyframes upstep-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
#upstep-modal{background:${p.bg};border:1px solid ${p.border};border-radius:${r(20)};width:100%;max-width:440px;max-height:calc(100dvh - 112px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.28);animation:upstep-rise .26s cubic-bezier(.16,1,.3,1)}
#upstep-header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 20px 0}
#upstep-header h2{margin:0;font-size:16px;font-weight:700;color:${p.text};letter-spacing:-.01em}
#upstep-header p{margin:2px 0 0;font-size:14px;color:${p.textFaint}}
#upstep-close{background:${p.bgSoft};border:none;width:28px;height:28px;border-radius:${r(8)};font-size:14px;cursor:pointer;color:${p.textSoft};line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s}
#upstep-close:hover{background:${p.bgHover};color:${p.text}}
#upstep-tabs{display:flex;gap:4px;margin:16px 20px 0;padding:4px;background:${p.bgSoft};border-radius:${r(11)}}
.upstep-tab{flex:1;padding:8px;background:none;border:none;border-radius:${r(8)};font-size:14px;font-weight:600;color:${p.textSoft};cursor:pointer;transition:all .15s}
.upstep-mode .upstep-tab.active{background:${p.bgSoft};box-shadow:none}
.upstep-tab.active{background:${p.bg};color:${p.text};box-shadow:0 1px 3px rgba(0,0,0,.08)}
#upstep-body{flex:1;overflow-y:auto;padding:18px 20px 22px}
.upstep-form textarea{width:100%;min-height:104px;border:1px solid ${p.border};border-radius:${r(12)};padding:12px;font-size:16px;line-height:1.6;resize:vertical;outline:none;background:${p.bgSoft};color:${p.text};transition:border-color .15s}
.upstep-form textarea::placeholder{color:${p.textFaint}}
.upstep-form textarea:focus{border-color:${accent};background:${p.bg}}
.upstep-type-row{display:flex;gap:7px;margin:12px 0 4px}
.upstep-type-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border-radius:${r(9)};border:1px solid ${p.border};background:${p.bg};color:${p.textSoft};font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
.upstep-type-btn svg{width:12px;height:12px;flex-shrink:0}
.upstep-type-btn:hover{border-color:${p.textFaint}}
.upstep-type-btn.selected{background:${accent};color:${on};border-color:${accent}}
.upstep-submit{width:100%;padding:12px;background:${accent};color:${on};border:none;border-radius:${r(11)};font-size:14px;font-weight:600;cursor:pointer;margin-top:14px;transition:filter .15s}
.upstep-submit:hover{filter:brightness(.94)}
.upstep-submit:disabled{opacity:.5;cursor:not-allowed}
#upstep-form-msg{font-size:14px;text-align:center;margin-top:12px;color:${accent};font-weight:500}
.upstep-feedback-item{display:flex;gap:12px;padding:14px;border:1px solid ${p.border};border-radius:${r(14)};margin-bottom:10px;background:${p.bg};transition:border-color .15s}
.upstep-feedback-item:hover{border-color:${p.textFaint}}
.upstep-vote{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;padding:7px 0;border-radius:${r(11)};border:1px solid ${p.border};background:${p.bgSoft};cursor:pointer;transition:all .15s}
.upstep-vote:hover{border-color:${accent}}
.upstep-vote.voted{border-color:${accent};background:${p.accentTint}}
.upstep-vote-arrow{font-size:11px;line-height:1;color:${accent}}
.upstep-vote-count{font-size:14px;font-weight:700;color:${p.text};line-height:1.1}
.upstep-feedback-main{flex:1;min-width:0}
.upstep-feedback-content{font-size:16px;line-height:1.5;color:${p.text};margin:0 0 8px;word-break:break-word}
.upstep-feedback-meta{display:flex;align-items:center;gap:7px}
.upstep-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:${r(9999)};font-size:10.5px;font-weight:700;letter-spacing:.02em}
.upstep-badge-bug{background:#fdecec;color:#d6453d}
.upstep-badge-feature{background:#e9f0fd;color:#3b76d6}
.upstep-badge-general{background:${p.bgSoft};color:${p.textSoft}}
.upstep-feedback-date{font-size:11px;color:${p.textFaint}}
#upstep-btn{position:fixed}
.upstep-unread{position:absolute;top:-7px;right:-5px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:${p.text};color:${p.bg};border:2px solid ${p.bg};font-size:12px;font-weight:700;line-height:18px;text-align:center;font-variant-numeric:tabular-nums;animation:upstep-pop .45s cubic-bezier(.3,1.6,.5,1)}
@keyframes upstep-pop{from{transform:scale(.4)}to{transform:scale(1)}}
#upstep-toast{position:fixed;bottom:84px;right:24px;z-index:9998;max-width:min(300px,calc(100vw - 48px));display:grid;gap:2px;text-align:left;background:${p.bg};color:${p.text};border:1px solid ${p.border};border-radius:${r(14)} ${r(14)} ${r(4)} ${r(14)};padding:10px 12px;box-shadow:0 10px 32px rgba(0,0,0,.2);cursor:pointer;animation:upstep-rise .26s cubic-bezier(.16,1,.3,1)}
#upstep-toast b{font-size:12px}
#upstep-toast span{font-size:14px;line-height:1.4;color:${p.textSoft};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#upstep-toast em{font-style:normal;font-size:11px;font-weight:600;color:${accent}}
@media(prefers-reduced-motion:reduce){.upstep-unread,#upstep-toast{animation:none}}
.upstep-empty{text-align:center;color:${p.textFaint};font-size:14px;padding:40px 0}
.upstep-empty strong{display:block;color:${p.textSoft};font-size:15px;margin-bottom:4px}
`;
}

const CHAT_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

type Tab = "submit" | "feed" | "support";

export interface WidgetOptions {
  accentColor?: string;
  /** Panel color overrides. Unset keys keep the default palette. */
  colors?: UpstepColorOverrides;
  /** Base corner radius in px. Defaults to 12. */
  radius?: number;
  /** CSS font-family for the widget. */
  fontFamily?: string;
  position?: "left" | "right";
  /** Color theme. "auto" follows the OS preference. Defaults to "auto". */
  theme?: ThemeMode;
  /** Render the floating launcher button. Defaults to true. */
  launcher?: boolean;
}

export class UpstepWidget {
  private client: UpstepApiClient;
  private isOpen = false;
  private tab: Tab = "submit";
  private feedItems: Feedback[] = [];
  private selectedType: FeedbackType = "GENERAL";
  private loading = false;
  private position: "left" | "right";
  private showLauncher: boolean;
  private themeMode: ThemeMode;
  private options: WidgetOptions;
  private palette: WidgetPalette;
  private hasSupport = false;
  private disconnectSupport: (() => void) | null = null;
  private unread = 0;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private audio: AudioContext | null = null;
  private frameTheme: "light" | "dark" | null = null;
  private unreadListeners = new Set<(count: number) => void>();

  constructor(client: UpstepApiClient, options: WidgetOptions = {}) {
    this.client = client;
    this.options = options;
    this.position = "right";
    this.showLauncher = options.launcher !== false;
    this.themeMode = options.theme ?? "auto";
    this.palette = this.buildPalette(resolveTheme(this.themeMode));
  }

  private buildPalette(mode: "light" | "dark") {
    return buildWidgetPalette({
      mode,
      accentColor: this.options.accentColor,
      colors: this.options.colors,
      radius: this.options.radius,
    });
  }

  private get accent() {
    return this.palette.accent;
  }

  private supportFrameSrc() {
    return this.client.supportFrameUrl(
      this.palette.dark ? "dark" : "light",
      this.accent,
      {
        colors: this.options.colors,
        radius: this.options.radius,
        fontFamily: this.options.fontFamily,
      },
    );
  }

  mount() {
    this.injectStyles();
    if (this.showLauncher) this.renderButton();
    void this.client.supportEnabled().then((enabled) => {
      this.hasSupport = enabled;
      if (enabled) {
        const label = document.querySelector("#upstep-btn span");
        if (label) label.textContent = "Help & feedback";
        if (this.isOpen) this.renderModal();
        // Visitors who have opened the chat before keep it loaded out of sight,
        // so a reply can raise a badge while it is closed. Everyone else loads nothing extra.
        else if (this.hasOpenedSupport()) this.preloadSupport();
      }
    });
  }

  /** Open the feedback modal programmatically (e.g. from your own button). */
  openWidget() {
    this.openModal();
  }

  /** Close the feedback modal programmatically. */
  closeWidget() {
    this.closeModal();
  }

  /** Whether the chat window is currently on screen. */
  isChatVisible() {
    return this.isOpen;
  }

  /** Number of unread support messages. Subscribe to drive your own launcher or badge. */
  onUnread(listener: (count: number) => void) {
    this.unreadListeners.add(listener);
    listener(this.unread);
    return () => {
      this.unreadListeners.delete(listener);
    };
  }

  private injectStyles() {
    document.getElementById("upstep-styles")?.remove();
    const style = document.createElement("style");
    style.id = "upstep-styles";
    style.textContent = buildStyles(
      this.palette,
      safeFontFamily(this.options.fontFamily),
    );
    document.head.appendChild(style);
  }

  private renderButton() {
    const btn = document.createElement("button");
    btn.id = "upstep-btn";
    btn.setAttribute("aria-label", "Open help and feedback");
    btn.innerHTML = `${CHAT_ICON}<span>Feedback</span>`;
    btn.addEventListener("click", () => {
      this.openModal();
    });
    document.body.appendChild(btn);
  }

  private supportFrame() {
    return document.querySelector<HTMLIFrameElement>("#upstep-support-frame");
  }

  private get usedKey() {
    return `upstep:support-opened:${this.client.baseUrl}`;
  }

  private hasOpenedSupport() {
    try {
      return localStorage.getItem(this.usedKey) === "1";
    } catch {
      return false;
    }
  }

  private preloadSupport() {
    this.tab = "support";
    this.renderModal(true);
  }

  private openModal() {
    this.unlockAudio();
    if (!this.isOpen && this.hasSupport) {
      this.tab = "support";
      try {
        localStorage.setItem(this.usedKey, "1");
      } catch {
        /* storage can be blocked */
      }
    }
    const theme = resolveTheme(this.themeMode);
    const backdrop = document.getElementById("upstep-backdrop");
    const frame = this.supportFrame();
    // The chat was preloaded and hidden: show it as it is, with its conversation intact.
    if (
      !this.isOpen &&
      backdrop &&
      frame &&
      backdrop.style.display === "none" &&
      this.frameTheme === theme
    ) {
      this.isOpen = true;
      backdrop.style.display = "";
      this.client.notifySupportVisibility(frame, true);
      this.setUnread(0);
      this.fetchFeed();
      return;
    }
    this.isOpen = true;
    // Re-resolve "auto" on every open so a theme toggled mid-session (no
    // reload) is picked up instead of freezing at the theme seen at mount.
    this.palette = this.buildPalette(theme);
    this.injectStyles();
    this.fetchFeed();
    this.renderModal();
    this.setUnread(0);
  }

  private closeModal() {
    this.isOpen = false;
    if (this.hasSupport) {
      const frame = this.supportFrame();
      const backdrop = document.getElementById("upstep-backdrop");
      if (frame && backdrop) {
        backdrop.style.display = "none";
        this.client.notifySupportVisibility(frame, false);
      } else {
        this.preloadSupport();
      }
      return;
    }
    this.disconnectSupport?.();
    this.disconnectSupport = null;
    document.getElementById("upstep-backdrop")?.remove();
  }

  private setUnread(count: number) {
    this.unread = count;
    const btn = document.getElementById("upstep-btn");
    const badge = btn?.querySelector(".upstep-unread");
    if (btn) {
      if (count > 0) {
        const el = badge ?? document.createElement("span");
        el.className = "upstep-unread";
        el.textContent = count > 9 ? "9+" : String(count);
        if (!badge) btn.appendChild(el);
      } else badge?.remove();
      btn.setAttribute(
        "aria-label",
        count > 0
          ? `Open help and feedback, ${count} unread ${count === 1 ? "message" : "messages"}`
          : "Open help and feedback",
      );
    }
    const base = document.title.replace(/^\(\d+\)\s/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
    if (count === 0) this.hideToast();
    this.unreadListeners.forEach((listener) => listener(count));
  }

  private onSupportUnread(unread: SupportUnread) {
    if (this.isOpen) return this.setUnread(0);
    this.setUnread(unread.count);
    if (unread.newMessage && unread.count > 0) {
      this.showToast(unread);
      if (unread.sound) this.chime();
    }
  }

  private showToast(unread: SupportUnread) {
    this.hideToast();
    const toast = document.createElement("button");
    toast.id = "upstep-toast";
    toast.type = "button";
    toast.setAttribute("role", "status");
    const who = document.createElement("b");
    who.textContent = unread.author || "New message";
    const text = document.createElement("span");
    text.textContent = unread.preview;
    const hint = document.createElement("em");
    hint.textContent =
      unread.count > 1 ? `${unread.count} new messages` : "Tap to reply";
    toast.append(who, text, hint);
    toast.addEventListener("click", () => this.openModal());
    document.body.appendChild(toast);
    this.toastTimer = setTimeout(() => this.hideToast(), 9000);
  }

  private hideToast() {
    clearTimeout(this.toastTimer);
    document.getElementById("upstep-toast")?.remove();
  }

  /** Browsers only allow sound after a click, so prepare audio when the chat is first opened. */
  private unlockAudio() {
    try {
      const Context =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Context) return;
      this.audio = this.audio ?? new Context();
      if (this.audio.state === "suspended") void this.audio.resume();
    } catch {
      /* sound is optional */
    }
  }

  private chime() {
    const ctx = this.audio;
    if (!ctx || ctx.state !== "running") return;
    const start = ctx.currentTime;
    for (const [frequency, offset] of [
      [880, 0],
      [1318, 0.12],
    ] as const) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.14, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.55);
    }
  }

  private async fetchFeed() {
    try {
      const data = await this.client.listFeedback({ sort: "votes", limit: 20 });
      this.feedItems = data.items;
      this.renderFeedList();
    } catch {
      // silently fail — feed is non-critical
    }
  }

  private renderModal(hidden = false) {
    this.disconnectSupport?.();
    this.disconnectSupport = null;
    const backdrop = document.createElement("div");
    backdrop.id = "upstep-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.closeModal();
    });

    backdrop.innerHTML = `
      <div id="upstep-modal" style="max-width:${this.hasSupport ? "460px" : "440px"}">
        ${this.hasSupport ? `<div class="upstep-mode" style="display:flex;align-items:center;gap:14px;padding:10px 14px;border-bottom:1px solid ${this.palette.border}"><div id="upstep-tabs" style="margin:0;padding:0;background:transparent;flex:1"><button class="upstep-tab ${this.tab === "support" ? "active" : ""}" data-tab="support">Support</button><button class="upstep-tab ${this.tab === "submit" ? "active" : ""}" data-tab="submit">Feedback</button><button class="upstep-tab ${this.tab === "feed" ? "active" : ""}" data-tab="feed">Ideas</button></div><button id="upstep-close" aria-label="Close" style="flex-shrink:0;background:transparent">✕</button></div>` : `<div id="upstep-header"><div><h2>Share your feedback</h2><p>Tell us what to build next, or vote on ideas.</p></div><button id="upstep-close" aria-label="Close">✕</button></div><div id="upstep-tabs"><button class="upstep-tab ${this.tab === "submit" ? "active" : ""}" data-tab="submit">Give feedback</button><button class="upstep-tab ${this.tab === "feed" ? "active" : ""}" data-tab="feed">Vote on ideas</button></div>`}
        <div id="upstep-body" style="${this.tab === "support" ? "padding:0;overflow:hidden" : ""}">
          ${this.tab === "support" ? `<iframe id="upstep-support-frame" title="Customer support" src="${escapeHtml(this.supportFrameSrc())}" style="width:100%;height:min(560px,calc(100dvh - 168px));min-height:300px;border:0;display:block"></iframe>` : this.tab === "submit" ? this.renderSubmitForm() : this.renderFeed()}
        </div>
      </div>
    `;

    document.getElementById("upstep-backdrop")?.remove();
    if (hidden) backdrop.style.display = "none";
    document.body.appendChild(backdrop);

    backdrop
      .querySelector("#upstep-close")
      ?.addEventListener("click", () => this.closeModal());
    backdrop.querySelectorAll(".upstep-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tab = (btn as HTMLElement).dataset["tab"] as Tab;
        this.renderModal();
      });
    });

    const frame = backdrop.querySelector<HTMLIFrameElement>(
      "#upstep-support-frame",
    );
    if (frame) {
      frame.style.color = this.accent;
      this.frameTheme = this.palette.dark ? "dark" : "light";
      this.disconnectSupport = this.client.connectSupportFrame(frame, {
        isVisible: () => this.isOpen,
        onUnread: (unread) => this.onSupportUnread(unread),
      });
    }
    this.bindSubmitForm();
    this.bindVoteButtons();
  }

  private renderSubmitForm(): string {
    const types: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
    const labels: Record<FeedbackType, string> = {
      BUG: "Bug",
      FEATURE: "Feature",
      GENERAL: "General",
    };
    const icons: Record<FeedbackType, string> = {
      BUG: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="10" rx="3.5" ry="4.5"/><path d="M8 5.5V4M5.5 6.5 3.5 5M10.5 6.5 12.5 5M4.5 10.5 2.5 10M11.5 10.5 13.5 10"/></svg>',
      FEATURE:
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1"/><circle cx="8" cy="8" r="2.5"/></svg>',
      GENERAL:
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H5L2 14V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5z"/></svg>',
    };
    return `
      <div class="upstep-form">
        <textarea id="upstep-textarea" placeholder="What's on your mind?" maxlength="2000"></textarea>
        <div class="upstep-type-row">
          ${types.map((t) => `<button class="upstep-type-btn${this.selectedType === t ? " selected" : ""}" data-type="${t}">${icons[t]}${labels[t]}</button>`).join("")}
        </div>
        <button class="upstep-submit" id="upstep-submit-btn">Send feedback</button>
        <div id="upstep-form-msg"></div>
      </div>
    `;
  }

  private renderFeed(): string {
    if (!this.feedItems.length) {
      return `<div class="upstep-empty"><strong>No ideas yet</strong>Be the first to share one.</div>`;
    }
    return this.feedItems
      .map(
        (f) => `
      <div class="upstep-feedback-item" data-id="${f.id}">
        <button class="upstep-vote${f.userVote === "UP" ? " voted" : ""}" data-vote="UP" data-feedback="${f.id}">
          <span class="upstep-vote-arrow">▲</span>
          <span class="upstep-vote-count">${f.upvotes}</span>
        </button>
        <div class="upstep-feedback-main">
          <p class="upstep-feedback-content">${escapeHtml(f.content)}</p>
          <div class="upstep-feedback-meta">
            <span class="upstep-badge upstep-badge-${f.type.toLowerCase()}">${f.type}</span>
            <span class="upstep-badge upstep-badge-general">${escapeHtml(f.boardStatus?.name ?? f.status.replace("_", " "))}</span>
            <span class="upstep-feedback-date">${new Date(f.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>`,
      )
      .join("");
  }

  private renderFeedList() {
    const body = document.getElementById("upstep-body");
    if (!body || this.tab !== "feed") return;
    body.innerHTML = this.renderFeed();
    this.bindVoteButtons();
  }

  private bindSubmitForm() {
    document.querySelectorAll(".upstep-type-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.selectedType = (btn as HTMLElement).dataset[
          "type"
        ] as FeedbackType;
        document
          .querySelectorAll(".upstep-type-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    document
      .getElementById("upstep-submit-btn")
      ?.addEventListener("click", async () => {
        const textarea = document.getElementById(
          "upstep-textarea",
        ) as HTMLTextAreaElement | null;
        const msg = document.getElementById("upstep-form-msg");
        const submitBtn = document.getElementById(
          "upstep-submit-btn",
        ) as HTMLButtonElement | null;

        if (!textarea || this.loading) return;
        const content = textarea.value.trim();
        if (!content) return;

        this.loading = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Sending…";
        }

        try {
          await this.client.submitFeedback({
            content,
            type: this.selectedType,
          });
          textarea.value = "";
          if (msg) msg.textContent = "Feedback received. Thank you.";
          await this.fetchFeed();
        } catch {
          if (msg) msg.textContent = "Something went wrong. Please try again.";
        } finally {
          this.loading = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send feedback";
          }
        }
      });
  }

  private bindVoteButtons() {
    document.querySelectorAll(".upstep-vote").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const feedbackId = (btn as HTMLElement).dataset["feedback"]!;
        try {
          await this.client.vote(feedbackId, "UP");
          await this.fetchFeed();
        } catch {
          // ignore
        }
      });
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
