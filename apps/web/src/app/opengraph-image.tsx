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
          background: "#0C0B09",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "72px 96px",
          position: "relative",
        }}
      >
        {/* Orange radial glow — right side */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: "60%",
            background:
              "radial-gradient(ellipse at 80% 40%, rgba(240,120,0,0.18) 0%, transparent 65%)",
          }}
        />

        {/* Logo row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 48,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={64}
            height={64}
            style={{ borderRadius: 14 }}
            alt=""
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#F5F4F0",
              letterSpacing: "-0.02em",
            }}
          >
            Upstep
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: "#F5F4F0",
            lineHeight: 1.02,
            letterSpacing: "-0.04em",
            margin: 0,
            marginBottom: 24,
            maxWidth: 840,
            position: "relative",
          }}
        >
          {"Feedback that "}
          <span style={{ color: "#F07800" }}>moves you</span>
          {" forward."}
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: 24,
            color: "#7A7870",
            margin: 0,
            lineHeight: 1.5,
            position: "relative",
            maxWidth: 640,
          }}
        >
          Drop-in feedback &amp; voting widget for web and mobile apps.
        </p>

        {/* Pills */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 44,
            position: "relative",
          }}
        >
          {["Collect feedback", "Let users vote", "Ship what matters"].map(
            (label) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  padding: "9px 20px",
                  fontSize: 17,
                  color: "#C8C6BF",
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
