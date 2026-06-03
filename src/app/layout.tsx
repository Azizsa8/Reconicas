import type { Metadata } from "next";
import { Inter, Tajawal, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app")
  .trim()
  .replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "ReconCart — Watch competitor prices in KSA",
    template: "%s · ReconCart",
  },
  description:
    "Paste a competitor product URL. We watch the price, stock, and reviews on Salla, Zid, Noon, and Shopify stores — and ping you when something moves.",
  applicationName: "ReconCart",
  keywords: [
    "competitor price tracking",
    "Saudi Arabia ecommerce",
    "Salla",
    "Zid",
    "Noon",
    "Shopify",
    "price monitoring",
    "stock alerts",
    "تتبع المنافسين",
  ],
  authors: [{ name: "AISERS FLOWs" }],
  openGraph: {
    type: "website",
    siteName: "ReconCart",
    url: SITE,
    title: "ReconCart — Watch competitor prices in KSA",
    description:
      "Paste a competitor product URL. We watch the price, stock, and reviews. You get pinged when something moves.",
    locale: "en_SA",
    alternateLocale: ["ar_SA"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReconCart — Watch competitor prices in KSA",
    description:
      "Competitive-intel for Saudi store owners. Salla, Zid, Noon, Shopify — alerts when prices or stock move.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${tajawal.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
