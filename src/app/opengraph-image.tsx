// Sitewide OG image — used by /, and as a fallback for any route that doesn't
// override with its own opengraph-image. 1200×630 is the Open Graph standard.
//
// Pure CSS via next/og ImageResponse — no external assets, regenerates per
// build. If you want per-route imagery, add opengraph-image.tsx inside that
// folder and it'll take precedence.
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ReconCart — Watch competitor prices in KSA";
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
            gap: 16,
            marginBottom: 56,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              background: "#0E1116",
              color: "#FAFAF7",
              borderRadius: 14,
              fontSize: 40,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              letterSpacing: -1,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}>
            ReconCart
          </div>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 24,
            maxWidth: 940,
          }}
        >
          Know your competitors&apos; prices
          <br />
          before they cut yours.
        </div>

        <div
          style={{
            fontSize: 30,
            color: "#52606D",
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          Watch Salla, Zid, Noon, and Shopify product URLs. Get pinged when
          price, stock, or reviews move.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            paddingTop: 24,
            borderTop: "1px solid #D8DCDF",
          }}
        >
          <div style={{ display: "flex", gap: 20, color: "#52606D", fontSize: 22 }}>
            <span>Salla</span>
            <span>·</span>
            <span>Zid</span>
            <span>·</span>
            <span>Noon</span>
            <span>·</span>
            <span>Shopify</span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#1F6FEB",
              fontWeight: 600,
            }}
          >
            reconcart.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
