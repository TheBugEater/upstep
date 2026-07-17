import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const alt = "Upstep | Feedback that ships itself";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { title: "Add dark mode to the dashboard", type: "FEATURE", status: "IN_PROGRESS", votes: 142 },
  { title: "Export feedback to CSV", type: "FEATURE", status: "OPEN", votes: 98 },
  { title: "Slack notifications for new feedback", type: "FEATURE", status: "OPEN", votes: 76 },
  { title: "Login button overlaps on iPhone SE", type: "BUG", status: "DONE", votes: 37 },
  { title: "Let users edit their submission", type: "GENERAL", status: "OPEN", votes: 21 },
] as const;

// Exact colors from BoardPreview / Tailwind config
type ColorSwatch = { text: string; bg: string; border: string };

const TYPE_COLOR: Record<"FEATURE" | "BUG" | "GENERAL", ColorSwatch> = {
  FEATURE: { text: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE" },
  BUG:     { text: "#DC2626", bg: "#FEF2F2", border: "#FEE2E2" },
  GENERAL: { text: "#6B6860", bg: "#F5F4EE", border: "#E8E6DF" },
};

const STATUS_COLOR: Record<"OPEN" | "IN_PROGRESS" | "DONE", ColorSwatch> = {
  OPEN:        { text: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  IN_PROGRESS: { text: "#2563EB", bg: "#EFF6FF", border: "#DBEAFE" },
  DONE:        { text: "#15803D", bg: "#F0FDF4", border: "#DCFCE7" },
};

export default async function Image() {
  const logoData = await readFile(path.join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;
  const visibleRows = ROWS.slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          background: "#09080A",
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 80px",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background glows */}
        <div style={{ position: "absolute", right: -60, top: "50%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(240,110,0,0.18) 0%, transparent 68%)", transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", left: -80, top: -80, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(100,50,200,0.08) 0%, transparent 70%)" }} />

        {/* Left: content */}
        <div style={{ display: "flex", flexDirection: "column", width: 560, position: "relative", zIndex: 1 }}>
          {/* Brand row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={44} height={44} style={{ borderRadius: 11 }} alt="" />
            <span style={{ fontSize: 23, fontWeight: 700, color: "#F5F4F0", letterSpacing: "-0.02em" }}>
              Upstep
            </span>
          </div>

          {/* MCP / AI agent badge - mirrors the live homepage hero badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              background: "rgba(240,120,0,0.1)",
              border: "1px solid rgba(240,120,0,0.3)",
              borderRadius: 999,
              padding: "7px 16px",
              marginBottom: 24,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F07800" }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: "#F5964D" }}>
              Built-in MCP server for AI agents
            </span>
          </div>

          {/* Headline - matches the live homepage hero */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 22 }}>
            <span style={{ fontSize: 68, fontWeight: 800, color: "#F5F4F0", letterSpacing: "-0.045em", lineHeight: 1.05 }}>
              Feedback that
            </span>
            <span style={{ fontSize: 68, fontWeight: 800, color: "#F07800", letterSpacing: "-0.045em", lineHeight: 1.05 }}>
              ships itself.
            </span>
          </div>

          {/* Tagline */}
          <p style={{ fontSize: 19, color: "#8A8880", margin: 0, marginBottom: 36, lineHeight: 1.5 }}>
            Drop-in feedback widget for web &amp; mobile. Your AI agent closes
            the loop over MCP.
          </p>

          {/* Pills */}
          <div style={{ display: "flex", gap: 10 }}>
            {["Feedback widget", "Voting board", "AI via MCP"].map((label) => (
              <div
                key={label}
                style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "7px 16px", fontSize: 14, color: "#9A9891", fontWeight: 500 }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: feedback list panel - white card matching BoardPreview */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingLeft: 48, paddingRight: 18, position: "relative", zIndex: 1, justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#FFFFFF", border: "1px solid #E8E6DF", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 4px rgba(26,25,21,0.05), 0 20px 48px rgba(26,25,21,0.18)" }}>

            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid #E8E6DF", background: "#FAF9F7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "#FDF0EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, color: "#D97757" }}>&#9636;</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1915" }}>Mobile App</span>
                  <span style={{ fontSize: 10, color: "#9B9890" }}>Feedback board</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: 11, color: "#6B6860" }}>Live</span>
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderBottom: "1px solid #E8E6DF" }}>
              <span style={{ background: "#1A1915", color: "#FFFFFF", fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 7 }}>All</span>
              <span style={{ background: "#F5F4EE", color: "#6B6860", fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 7, border: "1px solid #E8E6DF" }}>Features</span>
              <span style={{ background: "#F5F4EE", color: "#6B6860", fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 7, border: "1px solid #E8E6DF" }}>Bugs</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#9B9890" }}>Sorted by votes</span>
            </div>

            {/* Rows */}
            {visibleRows.map((row, i) => {
              const tc = TYPE_COLOR[row.type];
              const sc = STATUS_COLOR[row.status];
              return (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 18px", borderBottom: i < visibleRows.length - 1 ? "1px solid #E8E6DF" : "none" }}
                >
                  {/* Upvote block - same as BoardPreview */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 40, minHeight: 42, borderRadius: 10, border: "1px solid #E8E6DF", background: "#F5F4EE", paddingTop: 4, paddingBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#D97757", lineHeight: 1, marginBottom: 2 }}>+</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1915", lineHeight: 1 }}>{row.votes}</span>
                  </div>

                  {/* Text */}
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#1A1915", marginBottom: 5 }}>{row.title}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 99, padding: "2px 7px" }}>
                        {row.type}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 99, padding: "2px 7px" }}>
                        {row.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating feedback widget - the actual embeddable widget, peeking over the board's corner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              position: "absolute",
              right: -18,
              bottom: -18,
            }}
          >
            <div
              style={{
                display: "flex",
                background: "#1A1915",
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                padding: "8px 12px",
                boxShadow: "0 8px 20px rgba(26,25,21,0.28)",
              }}
            >
              Got feedback?
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#F07800",
                boxShadow: "0 10px 24px rgba(240,120,0,0.4)",
                border: "3px solid #09080A",
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFFFFF" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFFFFF" }} />
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFFFFF" }} />
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
