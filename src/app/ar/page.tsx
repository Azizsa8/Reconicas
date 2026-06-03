// Arabic landing — KSA-first. `dir="rtl"` cascades from the page wrapper so
// the root html lang stays "en" (we'd need full i18n routing to flip the html
// attribute, which is overkill for a marketing page). Tailwind 4 handles RTL
// via the CSS direction inheritance — flex/grid mirror naturally.
//
// Translation choices: Modern Standard Arabic, but with KSA-friendly,
// non-stilted phrasing. Brand names ("ReconCart", "Salla", "Zid", "Noon",
// "Shopify") kept in Latin — that's how they're written in Saudi marketing
// copy and search.
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Eye, Bell, Webhook, Lock, ShieldCheck, Languages } from "lucide-react";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app")
  .trim()
  .replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "ReconCart — راقب أسعار منافسيك في السوق السعودي",
  description:
    "الصق رابط منتج المنافس. نراقب السعر والمخزون والتقييمات على متاجر سلة وزد ونون وShopify — ونُنبّهك عند أي تغيّر.",
  alternates: {
    canonical: `${SITE}/ar`,
    languages: { en: SITE, "ar-SA": `${SITE}/ar` },
  },
  openGraph: {
    locale: "ar_SA",
    alternateLocale: ["en_SA"],
    title: "ReconCart — راقب أسعار منافسيك في السوق السعودي",
    description:
      "الصق رابط منتج المنافس. نتحقق كل ساعة ونُنبّهك لحظة تغيّر السعر أو المخزون.",
  },
};

const PLATFORMS = ["سلة", "زد", "نون", "Amazon.sa", "Shopify"];

const FEATURES = [
  {
    icon: Eye,
    title: "متابعة بدون أي إعدادات",
    body:
      "الصق أي رابط منتج. نتعرف تلقائيًا على سلة وزد وShopify ونقرأ السعر والمخزون والتقييم والمراجعات عبر JSON-LD وOpen Graph — بدون تثبيت أي شيء عند المنافس.",
  },
  {
    icon: Bell,
    title: "شروط بلغتك",
    body:
      "اكتب «نبّهني إذا نزل السعر تحت 199 ريال» أو «نبّهني عند نفاد المخزون لمدة 48 ساعة». نترجمها إلى قاعدة مهيكلة — ونوضّحها لك بالعربية أو الإنجليزية.",
  },
  {
    icon: Webhook,
    title: "تنبيهات أينما تعمل",
    body:
      "Webhooks مُوقّعة (Slack، Make، Zapier، أو خادمك)، بريد إلكتروني، وصندوق وارد داخل التطبيق. كل تسليم موثّق، مع فلاتر وحدود معدّل لكل قناة.",
  },
  {
    icon: Lock,
    title: "عزل بيانات لكل مساحة عمل",
    body:
      "سياسات Row-Level Security على Postgres لكل جدول — لا يمكن لأي كوكي مزوّر أن يوسّع صلاحيات المستخدم. تصدير البيانات وحذف الحساب وفق نظام حماية البيانات السعودي PDPL ميزتان أساسيتان.",
  },
];

export default function ArLandingPage() {
  return (
    <main dir="rtl" className="flex-1 flex flex-col bg-[var(--bg-canvas)]" style={{ fontFamily: "var(--font-tajawal), Tajawal, sans-serif" }}>
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-[var(--fg-muted)]">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">العرض المباشر</Link>
            <Link href="/ar/pricing" className="hover:text-[var(--fg-primary)]">الأسعار</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">الواجهة البرمجية</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">الأمان</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden sm:inline-flex items-center gap-1 text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">
              <Languages size={12} />
              English
            </Link>
            <Link href="/login" className="text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)] px-2">
              تسجيل الدخول
            </Link>
            <Link href="/signup" className="btn btn-primary !py-1.5 !text-[13px]">
              ابدأ مجانًا
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4 pt-16 pb-12">
        <div className="max-w-[820px] w-full text-center">
          <div className="inline-flex items-center gap-2 text-[12px] text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/25 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            متوفّر الآن · سلة · زد · نون · Shopify
          </div>
          <h1 className="text-[42px] sm:text-[56px] font-bold tracking-tight leading-[1.05] mb-5 text-[var(--fg-primary)]">
            اعرف أسعار منافسيك
            <br className="hidden sm:inline" />
            قبل أن يخفضوا أسعارهم.
          </h1>
          <p className="text-[var(--fg-muted)] text-[17px] mb-8 leading-[1.7] max-w-[640px] mx-auto">
            نراقب لك المتاجر السعودية. الصق رابط منتج المنافس — نتحقق منه كل ساعة
            ونُنبّهك لحظة تغيّر السعر أو المخزون أو التقييمات.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn btn-primary btn-lg">
              <ArrowLeft size={16} />
              ابدأ مجانًا — 3 متابعات
            </Link>
            <Link href="/demo" className="btn btn-secondary btn-lg">
              شاهد العرض المباشر
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-[var(--fg-muted)]">
            بدون بطاقة. بدون إعداد. الباقة المجانية لا تنتهي.
          </p>

          <div className="mt-14 flex items-center justify-center gap-6 sm:gap-8 flex-wrap text-[13px] text-[var(--fg-muted)]">
            <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--fg-muted)]/70">يعمل مع</span>
            {PLATFORMS.map((p) => (
              <span key={p} className="font-medium text-[var(--fg-primary)]/75">{p}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <f.icon size={18} className="text-[var(--accent)]" />
                  <h3 className="text-[16px] font-semibold">{f.title}</h3>
                </div>
                <p className="text-[14px] leading-[1.75] text-[var(--fg-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-[860px] mx-auto card p-6 flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-[var(--success)]" />
            <div>
              <div className="text-[15px] font-semibold">مبني للامتثال السعودي أولًا</div>
              <div className="text-[13px] text-[var(--fg-muted)]">
                توافق مع نظام PDPL · توقيع HMAC للـ Webhooks · عزل بيانات لكل مساحة عمل · تحقق بخطوتين.
              </div>
            </div>
          </div>
          <Link href="/security" className="text-[13px] font-medium text-[var(--accent)] hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={13} />
            اقرأ نظرة الأمان
          </Link>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-[700px] mx-auto text-center">
          <h2 className="text-[24px] font-semibold mb-3">ابدأ في 30 ثانية.</h2>
          <p className="text-[14px] text-[var(--fg-muted)] mb-5">
            3 متابعات مجانًا، إلى الأبد. ارفع باقتك فقط حين تحتاج فعلًا.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup" className="btn btn-primary btn-lg">
              أنشئ مساحة عملك
            </Link>
            <Link href="/ar/pricing" className="btn btn-secondary btn-lg">
              شاهد الأسعار
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-6 px-4">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--fg-muted)]">
          <span>© {new Date().getFullYear()} ReconCart · AISERS FLOWs</span>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">العرض المباشر</Link>
            <Link href="/ar/pricing" className="hover:text-[var(--fg-primary)]">الأسعار</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">الواجهة البرمجية</Link>
            <Link href="/roadmap" className="hover:text-[var(--fg-primary)]">خارطة الطريق</Link>
            <Link href="/changelog" className="hover:text-[var(--fg-primary)]">سجل التغييرات</Link>
            <Link href="/status" className="hover:text-[var(--fg-primary)]">حالة الخدمة</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">الأمان</Link>
            <Link href="/privacy" className="hover:text-[var(--fg-primary)]">الخصوصية</Link>
            <Link href="/terms" className="hover:text-[var(--fg-primary)]">الشروط</Link>
            <Link href="/" className="hover:text-[var(--fg-primary)]">English</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
