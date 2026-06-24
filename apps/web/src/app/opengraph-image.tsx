import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const alt = "Upstep | Feedback that moves you forward";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { title: "Add dark mode to the dashboard", type: "FEATURE", status: "IN_PROGRESS", votes: 142 },
  { title: "Export feedback to CSV", type: "FEATURE", status: "OPEN", votes: 98 },
  { title: "Slack notifications for new feedback", type: "FEATURE", status: "OPEN", votes: 76 },
  { title: "Login button overlaps on iPhone SE", type: "BUG", status: "DONE", votes: 37 },
  { title: "Let users edit their submission", type: "GENERAL", status: "OPEN", votes: 21 },
] as const;

type ColorSwatch = { text: string; bg: string; border: string };

const TYPE_COLOR: Record<"FEATURE" | "BUG" | "GENERAL", ColorSwatch> = {
  FEATURE: { text: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.22)" },
  BUG:     { text: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.22)"  },
  GENERAL: { text: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)" },
};

const STATUS_COLOR: Record<"OPEN" | "IN_PROGRESS" | "DONE", ColorSwatch> = {
  OPEN:        { text: "#b45309", bg: "rgba(180,83,9,0.1)",    border: "rgba(180,83,9,0.22)"    },
  IN_PROGRESS: { text: "#3b82f6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.22)"  },
  DONE:        { text: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.22)"   },
};

export default async function Image() {
  const logoData = await readFile(path.join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 52 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={44} height={44} style={{ borderRadius: 11 }} alt="" />
            <span style={{ fontSize: 23, fontWeight: 700, color: "#F5F4F0", letterSpacing: "-0.02em" }}>
              Upstep
            </span>
          </div>

          {/* Headline — three explicit lines, no wrapping */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 26 }}>
            <span style={{ fontSize: 68, fontWeight: 800, color: "#F5F4F0", letterSpacing: "-0.045em", lineHeight: 1.0 }}>
              Feedback that
            </span>
            <span style={{ fontSize: 68, fontWeight: 800, color: "#F07800", letterSpacing: "-0.045em", lineHeight: 1.0 }}>
              moves you
            </span>
            <span style={{ fontSize: 68, fontWeight: 800, color: "#F5F4F0", letterSpacing: "-0.045em", lineHeight: 1.0 }}>
              forward.
            </span>
          </div>

          {/* Tagline */}
          <p style={{ fontSize: 19, color: "#5E5D58", margin: 0, marginBottom: 40, lineHeight: 1.5 }}>
            Drop-in feedback &amp; voting widget for web and mobile apps.
          </p>

          {/* Pills */}
          <div style={{ display: "flex", gap: 10 }}>
            {["Collect feedback", "Let users vote", "Ship what matters"].map((label) => (
              <div
                key={label}
                style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, padding: "7px 16px", fontSize: 14, color: "#9A9891", fontWeight: 500 }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: feedback list panel */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingLeft: 48, position: "relative", zIndex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 18, overflow: "hidden", boxShadow: "0 0 0 1px rgba(0,0,0,0.5), 0 20px 40px rgba(0,0,0,0.55)" }}>

            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(240,120,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 12, height: 12, background: "#F07800", borderRadius: 3 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#EDECEA" }}>Mobile App</span>
                  <span style={{ fontSize: 10, color: "#4A4945" }}>Feedback board</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                <span style={{ fontSize: 11, color: "#5E5D58" }}>Live</span>
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ background: "#F5F4F0", color: "#09080A", fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 7 }}>All</div>
              <div style={{ background: "rgba(255,255,255,0.06)", color: "#6E6C66", fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)" }}>Features</div>
              <div style={{ background: "rgba(255,255,255,0.06)", color: "#6E6C66", fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)" }}>Bugs</div>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "#4A4945" }}>Sorted by votes</span>
            </div>

            {/* Rows */}
            {ROWS.map((row, i) => {
              const tc = TYPE_COLOR[row.type];
              const sc = STATUS_COLOR[row.status];
              return (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < ROWS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                >
                  {/* Upvote block */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 38, minHeight: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", paddingTop: 4, paddingBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "#F07800", lineHeight: 1, marginBottom: 1 }}>+</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#EDECEA", lineHeight: 1 }}>{row.votes}</span>
                  </div>

                  {/* Text */}
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#CCCAC4", marginBottom: 5, overflow: "hidden" }}>{row.title}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: tc.text, background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.3px" }}>
                        {row.type}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 99, padding: "2px 7px", letterSpacing: "0.3px" }}>
                        {row.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
