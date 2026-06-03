import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ReconCart API reference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0E1116",
          padding: 72,
          fontFamily: "Inter, sans-serif",
          color: "#E8EAED",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 48 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: "#FAFAF7",
              color: "#0E1116",
              borderRadius: 12,
              fontSize: 34,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            R
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>ReconCart</div>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 24,
          }}
        >
          API reference
        </div>
        <div style={{ fontSize: 28, color: "#8E96A4", maxWidth: 880, lineHeight: 1.4 }}>
          Tracks, alerts, channels, webhooks — HMAC-signed, OpenAPI-described, curl &amp;
          Python examples included.
        </div>

        <div
          style={{
            marginTop: "auto",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 24,
            background: "#171A21",
            color: "#4f9bff",
            border: "1px solid #262B33",
            borderRadius: 10,
            padding: "20px 24px",
          }}
        >
          curl -H &quot;Authorization: Bearer rc_live_…&quot; reconcart.vercel.app/api/v1/tracks
        </div>
      </div>
    ),
    { ...size },
  );
}
