// /demo route-specific OG card. Same visual language, different headline so
// links shared from /demo telegraph "click for the live thing" rather than
// generic site copy.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ReconCart live demo — real competitor data, no signup";
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
          background:
            "linear-gradient(135deg, #FAFAF7 0%, #F4F4EE 60%, #E8E9E0 100%)",
          padding: 72,
          fontFamily: "Inter, sans-serif",
          color: "#0E1116",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: "#0E1116",
              color: "#FAFAF7",
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
          <div
            style={{
              marginLeft: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              background: "rgba(31, 111, 235, 0.15)",
              color: "#1F6FEB",
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#1F6FEB",
              }}
            />
            Live demo
          </div>
        </div>

        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 24,
            maxWidth: 980,
          }}
        >
          See real competitor data.
          <br />
          No signup required.
        </div>

        <div style={{ fontSize: 30, color: "#52606D", lineHeight: 1.4, maxWidth: 900 }}>
          A public demo workspace with live prices, stock, and sparklines —
          updating every hour.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: "1px solid #D8DCDF",
          }}
        >
          <div style={{ color: "#52606D", fontSize: 22 }}>Updates every hour · 4 demo tracks</div>
          <div style={{ fontSize: 22, color: "#1F6FEB", fontWeight: 600 }}>
            reconcart.vercel.app/demo
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
