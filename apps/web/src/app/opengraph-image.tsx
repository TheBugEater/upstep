import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const alt = "Upstep | Feedback that moves you forward";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        <div
          style={{
            position: "absolute",
            right: -80,
            top: "50%",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(240,110,0,0.22) 0%, transparent 68%)",
            transform: "translateY(-50%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -80,
            top: -80,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(100,50,200,0.09) 0%, transparent 70%)",
          }}
        />

        {/* Left: content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 620,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 56,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              width={46}
              height={46}
              style={{ borderRadius: 11 }}
              alt=""
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#F5F4F0",
                letterSpacing: "-0.02em",
              }}
            >
              Upstep
            </span>
          </div>

          {/* Headline - three explicit lines, no wrapping */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontSize: 70,
                fontWeight: 800,
                color: "#F5F4F0",
                letterSpacing: "-0.045em",
                lineHeight: 1.0,
              }}
            >
              Feedback that
            </span>
            <span
              style={{
                fontSize: 70,
                fontWeight: 800,
                color: "#F07800",
                letterSpacing: "-0.045em",
                lineHeight: 1.0,
              }}
            >
              moves you
            </span>
            <span
              style={{
                fontSize: 70,
                fontWeight: 800,
                color: "#F5F4F0",
                letterSpacing: "-0.045em",
                lineHeight: 1.0,
              }}
            >
              forward.
            </span>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontSize: 20,
              color: "#5E5D58",
              margin: 0,
              marginBottom: 44,
              lineHeight: 1.5,
            }}
          >
            Drop-in feedback & voting widget for web and mobile apps.
          </p>

          {/* Pills */}
          <div style={{ display: "flex", gap: 10 }}>
            {["Collect feedback", "Let users vote", "Ship what matters"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(255,255,255,0.055)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 999,
                    padding: "8px 18px",
                    fontSize: 15,
                    color: "#9A9891",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        {/* Right: product card mockup */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            paddingLeft: 56,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Back card (offset) */}
          <div
            style={{
              position: "absolute",
              bottom: 32,
              left: 96,
              right: -8,
              height: 90,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 18,
            }}
          />

          {/* Middle card (offset) */}
          <div
            style={{
              position: "absolute",
              bottom: 56,
              left: 72,
              right: -4,
              height: 108,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 18,
            }}
          />

          {/* Main feedback card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 20,
              padding: "24px 26px",
              width: "100%",
              position: "relative",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 24px 48px rgba(0,0,0,0.5)",
            }}
          >
            {/* Type badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#3b82f6",
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: 99,
                  padding: "3px 10px",
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                }}
              >
                Feature request
              </span>
            </div>

            {/* Title */}
            <p
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: "#EDECEA",
                margin: 0,
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              Add dark mode support
            </p>

            {/* Body */}
            <p
              style={{
                fontSize: 13,
                color: "#5A5955",
                margin: 0,
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Would love a dark mode option for late-night usage.
            </p>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#F07800" }} />
                <span style={{ fontSize: 14, color: "#F07800", fontWeight: 700 }}>89</span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#22c55e",
                  background: "rgba(34,197,94,0.1)",
                  border: "1px solid rgba(34,197,94,0.2)",
                  borderRadius: 99,
                  padding: "3px 10px",
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                }}
              >
                Open
              </div>
            </div>
          </div>

          {/* Second visible card below */}
          <div
            style={{
              display: "flex",
              marginTop: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 16,
              padding: "14px 20px",
              width: "90%",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#ef4444",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 99,
                padding: "3px 10px",
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              Bug
            </span>
            <span style={{ fontSize: 14, color: "#7A7870", flex: 1 }}>
              Search results not loading on mobile
            </span>
            <span style={{ fontSize: 13, color: "#4A4945" }}>34 votes</span>
          </div>

          {/* Third compact card */}
          <div
            style={{
              display: "flex",
              marginTop: 8,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.065)",
              borderRadius: 14,
              padding: "10px 18px",
              width: "80%",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#6b7280",
                background: "rgba(107,114,128,0.1)",
                border: "1px solid rgba(107,114,128,0.18)",
                borderRadius: 99,
                padding: "3px 10px",
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              General
            </span>
            <span style={{ fontSize: 13, color: "#3D3B36", flex: 1 }}>
              Onboarding flow feels confusing
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
