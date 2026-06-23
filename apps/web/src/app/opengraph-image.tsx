import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Upstep — Feedback that moves you forward";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#FAF9F7",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          position: "relative",
        }}
      >
        {/* Subtle grid dots */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, #E0DDD3 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
            opacity: 0.6,
          }}
        />
        {/* Warm glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: "radial-gradient(80% 80% at 30% 0%, rgba(217,119,87,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 52, position: "relative" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#D97757",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M4 16.5L9.5 11L13 14.5L20 7.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 7.5H20V12.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1A1915", letterSpacing: "-0.02em" }}>
            Upstep
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1A1915",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            margin: 0,
            marginBottom: 28,
            maxWidth: 820,
            position: "relative",
          }}
        >
          Feedback that{" "}
          <span style={{ color: "#D97757" }}>moves you</span>
          {" "}forward.
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: 26,
            color: "#6B6860",
            margin: 0,
            lineHeight: 1.4,
            position: "relative",
          }}
        >
          Drop-in feedback &amp; voting widget for web and mobile apps.
        </p>

        {/* Pills */}
        <div style={{ display: "flex", gap: 12, marginTop: 44, position: "relative" }}>
          {["Collect feedback", "Let users vote", "Ship what matters"].map((label) => (
            <div
              key={label}
              style={{
                background: "#FFFFFF",
                border: "1.5px solid #E8E6DF",
                borderRadius: 999,
                padding: "10px 20px",
                fontSize: 18,
                color: "#3D3B35",
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
