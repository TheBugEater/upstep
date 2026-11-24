import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Upstep | AI Chat Support, Feedback & Roadmaps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(path.join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 42, width: "100%", height: "100%", padding: "70px 74px", background: "#fcfaf7", color: "#211916" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" width={42} height={42} style={{ borderRadius: 10 }} />
            <span style={{ fontSize: 25, fontWeight: 700 }}>Upstep</span>
          </div>
          <span style={{ fontSize: 62, fontWeight: 800, letterSpacing: -4, lineHeight: 1.02 }}>Help users.</span>
          <span style={{ fontSize: 62, fontWeight: 800, letterSpacing: -4, lineHeight: 1.02 }}>Build what</span>
          <span style={{ fontSize: 62, fontWeight: 800, letterSpacing: -4, lineHeight: 1.02, color: "#963415" }}>matters.</span>
          <span style={{ marginTop: 25, fontSize: 19, color: "#51463f" }}>AI and live chat, feedback and roadmaps.</span>
        </div>

        <div style={{ display: "flex", width: 490, height: 386, alignItems: "center", justifyContent: "center", borderRadius: 29, background: "linear-gradient(140deg, #f8e4d7, #eaa384)", border: "1px solid #dfab93", padding: 34 }}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", borderRadius: 17, background: "#ffffff", border: "1px solid #eadbd3", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", background: "#2a201c", color: "#ffffff", fontSize: 17, fontWeight: 700 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#ffaf8d" }} />
              Northstar Support
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", padding: 19 }}>
              <div style={{ display: "flex", alignSelf: "flex-end", borderRadius: 10, padding: "10px 12px", background: "#f7e6dc", fontSize: 15 }}>
                My CSV export is stuck at 99%.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 279, borderRadius: 10, padding: "10px 12px", background: "#f6f4f2", fontSize: 15 }}>
                <span style={{ color: "#963415", fontSize: 12, fontWeight: 700 }}>AI assistant</span>
                Try a shorter date range. If it still stalls, I can bring in the team.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#1f6b39", fontWeight: 700 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: "#1f6b39" }} />
                Alex from support joined
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
