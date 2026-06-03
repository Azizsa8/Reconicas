// Arabic /ar/pricing — mirrors the English /pricing page with full RTL and
// Arabic copy. Tiers/numbers come from the shared lib so they can't drift.
import Link from "next/link";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { TIERS, COMPARE, annualDiscountPct, type Tier } from "@/lib/pricing";
import { ArPricingClient } from "./_client";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://reconcart.vercel.app")
  .trim()
  .replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "أسعار شفافة بالريال — ReconCart",
  description:
    "أسعار بسيطة بالريال. الباقة المجانية تكفي للتقييم، الـStarter لمتجر واحد، والـPro للاستخدام المكثّف مع API.",
  alternates: {
    canonical: `${SITE}/ar/pricing`,
    languages: { en: `${SITE}/pricing`, "ar-SA": `${SITE}/ar/pricing` },
  },
  openGraph: {
    locale: "ar_SA",
    title: "ReconCart — الأسعار",
    description: "أسعار بسيطة وشفافة بالريال السعودي.",
  },
};

const SECTION_AR: Record<string, string> = {
  Tracking: "المتابعة",
  "Alerts & delivery": "التنبيهات والتسليم",
  "API & integrations": "الواجهة البرمجية والتكاملات",
  "Security & compliance": "الأمان والامتثال",
  Support: "الدعم",
};

const FEATURE_AR: Record<string, string> = {
  "Active tracks": "متابعات نشطة",
  "Scrape cadence": "وتيرة التحديث",
  "Historical retention": "مدة حفظ التاريخ",
  "Bulk CSV import": "استيراد جماعي عبر CSV",
  "Multi-workspace": "تعدد مساحات العمل",
  "In-app inbox": "صندوق وارد داخل التطبيق",
  "Email channel": "قناة البريد الإلكتروني",
  "Slack channel": "قناة Slack",
  "Custom webhook (HMAC-signed)": "Webhook مخصّص (مُوقّع بـ HMAC)",
  "Per-channel filters & rate limits": "فلاتر وحدود معدّل لكل قناة",
  "Public REST API (/api/v1)": "واجهة REST عامة (/api/v1)",
  "API key management": "إدارة مفاتيح API",
  "OpenAPI spec": "مواصفات OpenAPI",
  "Zapier / Make / n8n via webhook": "Zapier / Make / n8n عبر Webhook",
  "Per-tenant RLS": "عزل بيانات لكل مساحة عمل (RLS)",
  "Two-factor authentication (TOTP)": "تحقق بخطوتين (TOTP)",
  "PDPL data export": "تصدير البيانات وفق PDPL",
  "Audit log retention": "مدة حفظ سجل التدقيق",
  Community: "المجتمع",
  "Email support": "دعم عبر البريد",
  "Priority response (1 business day)": "أولوية الاستجابة (يوم عمل واحد)",
};

const VALUE_AR: Record<string, string> = {
  Daily: "يوميًا",
  "Daily + weekly": "يومي + أسبوعي",
  Hourly: "كل ساعة",
  "7 days": "7 أيام",
  "30 days": "30 يومًا",
  "180 days": "180 يومًا",
  "1 year": "سنة",
  "90 days": "90 يومًا",
};

const TAGLINE_AR: Record<string, string> = {
  free: "للتقييم",
  starter: "لمتجر واحد",
  pro: "للاستخدام المكثّف",
};

const FEATURES_AR: Record<string, string[]> = {
  free: ["3 متابعات", "وتيرة يومية", "تنبيهات بريد فقط", "دعم المجتمع"],
  starter: [
    "25 متابعة",
    "وتيرة يومية + أسبوعية",
    "كل القنوات (Slack/بريد/Webhook)",
    "تاريخ 30 يومًا",
    "دعم عبر البريد",
  ],
  pro: [
    "100 متابعة",
    "وتيرة كل ساعة",
    "وصول للـ API (مفاتيح rc_live_)",
    "تاريخ 180 يومًا",
    "دعم بأولوية",
  ],
};

export default function ArPricingPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[var(--bg-canvas)]" style={{ fontFamily: "var(--font-tajawal), Tajawal, sans-serif" }}>
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-[1100px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/ar" className="flex items-center gap-2">
            <span className="brand-glyph">R</span>
            <span className="font-semibold text-[15px]">ReconCart</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-[13px] text-[var(--fg-muted)]">
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">العرض المباشر</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">الواجهة البرمجية</Link>
            <Link href="/security" className="hover:text-[var(--fg-primary)]">الأمان</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-primary)]">
              EN
            </Link>
            <Link href="/signup" className="btn btn-primary !py-1.5 !text-[13px]">ابدأ مجانًا</Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-12">
        <div className="text-center max-w-[640px] mx-auto">
          <h1 className="text-[36px] font-semibold tracking-tight">أسعار شفّافة بالريال.</h1>
          <p className="text-[15px] text-[var(--fg-muted)] mt-3 leading-[1.7]">
            مجاني للتقييم. ادفع فقط حين تحتاج فعلًا متابعات أكثر، أو وتيرة أسرع،
            أو واجهتنا البرمجية. بدون رسوم إعداد، بدون رسوم لكل مستخدم.
          </p>
        </div>

        <ArPricingClient
          tiers={TIERS}
          taglines={TAGLINE_AR}
          featuresAr={FEATURES_AR}
          discountByTier={Object.fromEntries(TIERS.map((t) => [t.id, annualDiscountPct(t)]))}
        />

        <p className="text-center text-[12px] text-[var(--fg-muted)] mt-3">
          الأسعار بالريال السعودي. ضريبة القيمة المضافة 15% تُعرض عند الدفع. ألغِ متى شئت — تُحفظ بياناتك 30 يومًا بعد الإلغاء.
        </p>

        <section className="mt-20">
          <h2 className="text-[22px] font-semibold text-center mb-2">مقارنة تفصيلية</h2>
          <p className="text-[13.5px] text-[var(--fg-muted)] text-center mb-8">كل ما تحصل عليه في كل باقة، جنبًا إلى جنب.</p>
          <div className="card overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-[var(--bg-elevated)] text-[12px] uppercase tracking-wide text-[var(--fg-muted)]">
                  <th className="text-right p-3 font-medium w-1/2">الميزة</th>
                  <th className="text-center p-3 font-medium">Free</th>
                  <th className="text-center p-3 font-medium">Starter</th>
                  <th className="text-center p-3 font-medium">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((sec) => (
                  <RowGroup key={sec.section} sectionAr={SECTION_AR[sec.section] || sec.section} rows={sec.rows} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <FAQ />
      </div>

      <footer className="border-t border-[var(--border)] py-6 px-4 mt-20">
        <div className="max-w-[1100px] mx-auto flex flex-wrap items-center justify-between gap-4 text-[12px] text-[var(--fg-muted)]">
          <span>© {new Date().getFullYear()} ReconCart · AISERS FLOWs</span>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/ar" className="hover:text-[var(--fg-primary)]">الرئيسية</Link>
            <Link href="/demo" className="hover:text-[var(--fg-primary)]">العرض المباشر</Link>
            <Link href="/docs" className="hover:text-[var(--fg-primary)]">الواجهة البرمجية</Link>
            <Link href="/pricing" className="hover:text-[var(--fg-primary)]">English pricing</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

function RowGroup({
  sectionAr,
  rows,
}: {
  sectionAr: string;
  rows: { feature: string; values: (string | boolean)[] }[];
}) {
  return (
    <>
      <tr className="bg-[var(--bg-canvas)]/40">
        <td colSpan={4} className="p-3 text-[11px] uppercase tracking-wide text-[var(--fg-muted)] font-medium text-right">
          {sectionAr}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.feature} className="border-t border-[var(--border)]">
          <td className="p-3 text-[var(--fg-primary)] text-right">
            {FEATURE_AR[r.feature] || r.feature}
          </td>
          {r.values.map((v, i) => (
            <td key={i} className="p-3 text-center tabular-nums">
              {typeof v === "boolean" ? (
                v ? (
                  <Check size={16} className="inline text-[var(--success)]" />
                ) : (
                  <X size={16} className="inline text-[var(--fg-muted)]/40" />
                )
              ) : (
                <span className="text-[var(--fg-primary)]">{VALUE_AR[v] || v}</span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function FAQ() {
  const items = [
    { q: "ما المقصود بـ«متابعة»؟", a: "رابط منتج منافس واحد — يُفحص حسب وتيرة باقتك. يمكنك الإضافة أو الإيقاف أو الحذف في أي وقت؛ الحد هو عدد المتابعات النشطة معًا." },
    { q: "هل أحتاج بطاقة للباقة المجانية؟", a: "لا. الباقة المجانية لا تنتهي وتظل مجانية ما دمت ضمن 3 متابعات ووتيرة يومية." },
    { q: "هل أستطيع تغيير الباقة لاحقًا؟", a: "نعم — رفع أو خفض الباقة من الإعدادات → الفوترة. الباقات السنوية تُحسب بالتناسب عند الترقية في منتصف الدورة." },
    { q: "هل تدعمون سلة وزد ونون افتراضيًا؟", a: "نعم. يتعرّف القارئ تلقائيًا عليهم وعلى Shopify وAmazon.sa وNamshi عبر JSON-LD وOpen Graph — بدون أي إعداد على المتجر." },
    { q: "ماذا يحدث لبياناتي عند الإلغاء؟", a: "تُحفظ 30 يومًا قبل الحذف النهائي. كما يمكنك حذفها فورًا أو تصديرها من الإعدادات → البيانات." },
    { q: "هل هناك خصم للدفع السنوي؟", a: "نعم — توفير ~17% (تدفع 10 أشهر وتحصل على 12). يظهر الخصم على الزر فوق البطاقات." },
  ];
  return (
    <section className="mt-20 max-w-[760px] mx-auto">
      <h2 className="text-[22px] font-semibold text-center mb-2">أسئلة شائعة</h2>
      <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {items.map((it) => (
          <details key={it.q} className="group py-5">
            <summary className="cursor-pointer list-none flex justify-between gap-4 text-[15px] font-medium">
              <span>{it.q}</span>
              <span className="text-[var(--fg-muted)] transition group-open:rotate-45">+</span>
            </summary>
            <p className="text-[13.5px] text-[var(--fg-muted)] mt-2 leading-[1.75]">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
