import type { Feedback, FeedbackType } from "@upstep/types";
import { UpstepApiClient } from "./api";

const DEFAULT_ACCENT = "#D97757";

type ThemeMode = "light" | "dark" | "auto";

interface Palette {
  bg: string;        // panel background
  bgSoft: string;    // inputs / subtle fills
  bgHover: string;   // hover fills
  text: string;      // primary text
  textSoft: string;  // secondary text
  textFaint: string; // tertiary text
  border: string;    // hairlines
  overlay: string;   // backdrop
}

const LIGHT: Palette = {
  bg: "#ffffff",
  bgSoft: "#f6f5f2",
  bgHover: "#efede8",
  text: "#1a1915",
  textSoft: "#56544d",
  textFaint: "#9b9890",
  border: "#e8e6df",
  overlay: "rgba(26,25,21,.45)",
};

const DARK: Palette = {
  bg: "#1c1b19",
  bgSoft: "#262522",
  bgHover: "#302e2a",
  text: "#f5f4f0",
  textSoft: "#b4b1a8",
  textFaint: "#7d7a72",
  border: "#33312c",
  overlay: "rgba(0,0,0,.6)",
};

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

/** Builds the widget stylesheet using the host app's accent, position & theme. */
function buildStyles(accent: string, position: "left" | "right", p: Palette): string {
  const side = position === "left" ? "left:24px" : "right:24px";
  return `
#upstep-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
#upstep-btn{position:fixed;bottom:24px;${side};z-index:9998;display:inline-flex;align-items:center;gap:7px;background:${accent};color:#fff;border:none;border-radius:9999px;padding:12px 18px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(26,25,21,.18);transition:transform .15s,box-shadow .15s}
#upstep-btn svg{width:16px;height:16px;flex-shrink:0}
#upstep-btn:hover{transform:translateY(-1px);box-shadow:0 8px 26px rgba(26,25,21,.24)}
#upstep-btn svg{width:16px;height:16px}
#upstep-backdrop{position:fixed;inset:0;background:${p.overlay};backdrop-filter:blur(3px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;animation:upstep-fade .2s ease}
@keyframes upstep-fade{from{opacity:0}to{opacity:1}}
@keyframes upstep-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
#upstep-modal{background:${p.bg};border:1px solid ${p.border};border-radius:20px;width:100%;max-width:440px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.28);animation:upstep-rise .26s cubic-bezier(.16,1,.3,1)}
#upstep-header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 20px 0}
#upstep-header h2{margin:0;font-size:16px;font-weight:700;color:${p.text};letter-spacing:-.01em}
#upstep-header p{margin:2px 0 0;font-size:12.5px;color:${p.textFaint}}
#upstep-close{background:${p.bgSoft};border:none;width:28px;height:28px;border-radius:8px;font-size:14px;cursor:pointer;color:${p.textSoft};line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s}
#upstep-close:hover{background:${p.bgHover};color:${p.text}}
#upstep-tabs{display:flex;gap:4px;margin:16px 20px 0;padding:4px;background:${p.bgSoft};border-radius:11px}
.upstep-tab{flex:1;padding:8px;background:none;border:none;border-radius:8px;font-size:13px;font-weight:600;color:${p.textSoft};cursor:pointer;transition:all .15s}
.upstep-tab.active{background:${p.bg};color:${p.text};box-shadow:0 1px 3px rgba(0,0,0,.08)}
#upstep-body{flex:1;overflow-y:auto;padding:18px 20px 22px}
.upstep-form textarea{width:100%;min-height:104px;border:1px solid ${p.border};border-radius:12px;padding:12px;font-size:14px;line-height:1.5;resize:vertical;outline:none;background:${p.bgSoft};color:${p.text};transition:border-color .15s}
.upstep-form textarea::placeholder{color:${p.textFaint}}
.upstep-form textarea:focus{border-color:${accent};background:${p.bg}}
.upstep-type-row{display:flex;gap:7px;margin:12px 0 4px}
.upstep-type-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px 10px;border-radius:9px;border:1px solid ${p.border};background:${p.bg};color:${p.textSoft};font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s}
.upstep-type-btn svg{width:12px;height:12px;flex-shrink:0}
.upstep-type-btn:hover{border-color:${p.textFaint}}
.upstep-type-btn.selected{background:${accent};color:#fff;border-color:${accent}}
.upstep-submit{width:100%;padding:12px;background:${accent};color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:600;cursor:pointer;margin-top:14px;transition:filter .15s}
.upstep-submit:hover{filter:brightness(.94)}
.upstep-submit:disabled{opacity:.5;cursor:not-allowed}
#upstep-form-msg{font-size:13px;text-align:center;margin-top:12px;color:${accent};font-weight:500}
.upstep-feedback-item{display:flex;gap:12px;padding:14px;border:1px solid ${p.border};border-radius:14px;margin-bottom:10px;background:${p.bg};transition:border-color .15s}
.upstep-feedback-item:hover{border-color:${p.textFaint}}
.upstep-vote{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;padding:7px 0;border-radius:11px;border:1px solid ${p.border};background:${p.bgSoft};cursor:pointer;transition:all .15s}
.upstep-vote:hover{border-color:${accent}}
.upstep-vote.voted{border-color:${accent};background:${accent}1a}
.upstep-vote-arrow{font-size:11px;line-height:1;color:${accent}}
.upstep-vote-count{font-size:14px;font-weight:700;color:${p.text};line-height:1.1}
.upstep-feedback-main{flex:1;min-width:0}
.upstep-feedback-content{font-size:13.5px;line-height:1.5;color:${p.text};margin:0 0 8px;word-break:break-word}
.upstep-feedback-meta{display:flex;align-items:center;gap:7px}
.upstep-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:9999px;font-size:10.5px;font-weight:700;letter-spacing:.02em}
.upstep-badge-bug{background:#fdecec;color:#d6453d}
.upstep-badge-feature{background:#e9f0fd;color:#3b76d6}
.upstep-badge-general{background:${p.bgSoft};color:${p.textSoft}}
.upstep-feedback-date{font-size:11px;color:${p.textFaint}}
.upstep-empty{text-align:center;color:${p.textFaint};font-size:14px;padding:40px 0}
.upstep-empty strong{display:block;color:${p.textSoft};font-size:15px;margin-bottom:4px}
`;
}

const CHAT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

type Tab = "submit" | "feed";

export interface WidgetOptions {
  accentColor?: string;
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
  private accent: string;
  private position: "left" | "right";
  private showLauncher: boolean;
  private palette: Palette;

  constructor(client: UpstepApiClient, options: WidgetOptions = {}) {
    this.client = client;
    this.accent = options.accentColor ?? DEFAULT_ACCENT;
    this.position = options.position ?? "right";
    this.showLauncher = options.launcher !== false;
    this.palette = resolveTheme(options.theme ?? "auto") === "dark" ? DARK : LIGHT;
  }

  mount() {
    this.injectStyles();
    if (this.showLauncher) this.renderButton();
  }

  /** Open the feedback modal programmatically (e.g. from your own button). */
  openWidget() {
    this.openModal();
  }

  /** Close the feedback modal programmatically. */
  closeWidget() {
    this.closeModal();
  }

  private injectStyles() {
    document.getElementById("upstep-styles")?.remove();
    const style = document.createElement("style");
    style.id = "upstep-styles";
    style.textContent = buildStyles(this.accent, this.position, this.palette);
    document.head.appendChild(style);
  }

  private renderButton() {
    const btn = document.createElement("button");
    btn.id = "upstep-btn";
    btn.innerHTML = `${CHAT_ICON}<span>Feedback</span>`;
    btn.addEventListener("click", () => this.openModal());
    document.body.appendChild(btn);
  }

  private openModal() {
    this.isOpen = true;
    this.fetchFeed();
    this.renderModal();
  }

  private closeModal() {
    this.isOpen = false;
    document.getElementById("upstep-backdrop")?.remove();
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

  private renderModal() {
    const backdrop = document.createElement("div");
    backdrop.id = "upstep-backdrop";
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.closeModal();
    });

    backdrop.innerHTML = `
      <div id="upstep-modal">
        <div id="upstep-header">
          <div>
            <h2>Share your feedback</h2>
            <p>Tell us what to build next, or vote on ideas.</p>
          </div>
          <button id="upstep-close" aria-label="Close">✕</button>
        </div>
        <div id="upstep-tabs">
          <button class="upstep-tab ${this.tab === "submit" ? "active" : ""}" data-tab="submit">Give feedback</button>
          <button class="upstep-tab ${this.tab === "feed" ? "active" : ""}" data-tab="feed">Vote on ideas</button>
        </div>
        <div id="upstep-body">
          ${this.tab === "submit" ? this.renderSubmitForm() : this.renderFeed()}
        </div>
      </div>
    `;

    document.getElementById("upstep-backdrop")?.remove();
    document.body.appendChild(backdrop);

    backdrop.querySelector("#upstep-close")?.addEventListener("click", () => this.closeModal());
    backdrop.querySelectorAll(".upstep-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.tab = (btn as HTMLElement).dataset["tab"] as Tab;
        this.renderModal();
      });
    });

    this.bindSubmitForm();
    this.bindVoteButtons();
  }

  private renderSubmitForm(): string {
    const types: FeedbackType[] = ["BUG", "FEATURE", "GENERAL"];
    const labels: Record<FeedbackType, string> = { BUG: "Bug", FEATURE: "Feature", GENERAL: "General" };
    const icons: Record<FeedbackType, string> = {
      BUG: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="10" rx="3.5" ry="4.5"/><path d="M8 5.5V4M5.5 6.5 3.5 5M10.5 6.5 12.5 5M4.5 10.5 2.5 10M11.5 10.5 13.5 10"/></svg>',
      FEATURE: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M4.1 4.1l1 1M10.9 10.9l1 1M11.9 4.1l-1 1M5.1 10.9l-1 1"/><circle cx="8" cy="8" r="2.5"/></svg>',
      GENERAL: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H5L2 14V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5z"/></svg>',
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
            <span class="upstep-feedback-date">${new Date(f.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>`
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
        this.selectedType = (btn as HTMLElement).dataset["type"] as FeedbackType;
        document.querySelectorAll(".upstep-type-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    document.getElementById("upstep-submit-btn")?.addEventListener("click", async () => {
      const textarea = document.getElementById("upstep-textarea") as HTMLTextAreaElement | null;
      const msg = document.getElementById("upstep-form-msg");
      const submitBtn = document.getElementById("upstep-submit-btn") as HTMLButtonElement | null;

      if (!textarea || this.loading) return;
      const content = textarea.value.trim();
      if (!content) return;

      this.loading = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      try {
        await this.client.submitFeedback({ content, type: this.selectedType });
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
