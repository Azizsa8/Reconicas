"use client";
// Drop-in "talk to sales" form. Renders inline; submits to /api/leads.
// Honeypot field is hidden via CSS — bots that auto-fill all text inputs
// trip it.
//
// Translation: pass i18n via props rather than reading from a global so the
// same component renders on /, /ar, /pricing, /ar/pricing, etc.

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";

export type LeadFormCopy = {
  heading: string;
  body: string;
  emailLabel: string;
  emailPlaceholder: string;
  companyLabel: string;
  companyPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  submitting: string;
  thanks: string;
  thanksBody: string;
  errorGeneric: string;
};

export const DEFAULT_EN_COPY: LeadFormCopy = {
  heading: "Talk to us",
  body: "Have a question, a special request, or want a guided tour? Drop your details — we usually reply within one business day.",
  emailLabel: "Email",
  emailPlaceholder: "you@example.com",
  companyLabel: "Company (optional)",
  companyPlaceholder: "Your store or company name",
  messageLabel: "What would you like to know? (optional)",
  messagePlaceholder: "Tell us about your store, your competitors, or what you'd like the tool to do…",
  submit: "Send",
  submitting: "Sending…",
  thanks: "Thanks — we got it.",
  thanksBody: "We'll reach out shortly. Meanwhile, feel free to poke around the live demo.",
  errorGeneric: "Something went wrong. Try again, or email ibrahim@reconcart.app directly.",
};

export const DEFAULT_AR_COPY: LeadFormCopy = {
  heading: "تواصل معنا",
  body: "عندك سؤال، طلب خاص، أو تبي جولة موجَّهة؟ اكتب بياناتك — نرد عادةً خلال يوم عمل واحد.",
  emailLabel: "البريد الإلكتروني",
  emailPlaceholder: "you@example.com",
  companyLabel: "اسم الشركة (اختياري)",
  companyPlaceholder: "اسم متجرك أو شركتك",
  messageLabel: "ما الذي تود معرفته؟ (اختياري)",
  messagePlaceholder: "أخبرنا عن متجرك، منافسيك، أو ما تريد من الأداة…",
  submit: "إرسال",
  submitting: "جارٍ الإرسال…",
  thanks: "وصلتنا بياناتك — شكرًا.",
  thanksBody: "سنتواصل معك قريبًا. في الأثناء، استكشف العرض المباشر.",
  errorGeneric: "حدث خطأ ما. حاول مرة أخرى، أو راسلنا مباشرة على ibrahim@reconcart.app.",
};

export function LeadForm({
  copy = DEFAULT_EN_COPY,
  source = "landing",
}: {
  copy?: LeadFormCopy;
  source?: string;
}) {
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      email: String(fd.get("email") || "").trim(),
      company: String(fd.get("company") || "").trim() || undefined,
      message: String(fd.get("message") || "").trim() || undefined,
      website: String(fd.get("website") || ""), // honeypot
      source,
    };

    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErrorMsg(body?.error || copy.errorGeneric);
        setState("error");
        return;
      }
      setState("success");
      form.reset();
    } catch {
      setErrorMsg(copy.errorGeneric);
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="card p-6 text-center">
        <div
          className="w-10 h-10 rounded-full inline-flex items-center justify-center mb-3"
          style={{ background: "color-mix(in srgb, var(--success) 18%, var(--bg-surface))", color: "var(--success)" }}
        >
          <Check size={20} />
        </div>
        <h3 className="text-[17px] font-semibold mb-1">{copy.thanks}</h3>
        <p className="text-[13.5px] text-[var(--fg-muted)] max-w-[480px] mx-auto">
          {copy.thanksBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-6">
      <h3 className="text-[18px] font-semibold mb-1">{copy.heading}</h3>
      <p className="text-[13.5px] text-[var(--fg-muted)] mb-5 leading-[1.55]">{copy.body}</p>

      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="lead-email">{copy.emailLabel}</label>
          <input
            id="lead-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            placeholder={copy.emailPlaceholder}
            disabled={state === "submitting"}
          />
        </div>
        <div>
          <label className="label" htmlFor="lead-company">{copy.companyLabel}</label>
          <input
            id="lead-company"
            name="company"
            type="text"
            autoComplete="organization"
            className="input"
            placeholder={copy.companyPlaceholder}
            disabled={state === "submitting"}
          />
        </div>
        <div>
          <label className="label" htmlFor="lead-message">{copy.messageLabel}</label>
          <textarea
            id="lead-message"
            name="message"
            rows={3}
            className="input"
            style={{ resize: "vertical" }}
            placeholder={copy.messagePlaceholder}
            disabled={state === "submitting"}
          />
        </div>

        {/* Honeypot — visually hidden, in the form for bots only. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="lead-website">Website</label>
          <input id="lead-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state === "error" && errorMsg && (
        <div className="banner banner-danger mt-4" role="alert">{errorMsg}</div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg mt-5 w-full justify-center"
        disabled={state === "submitting"}
      >
        {state === "submitting" ? copy.submitting : (<><span>{copy.submit}</span><ArrowRight size={15} /></>)}
      </button>
    </form>
  );
}
