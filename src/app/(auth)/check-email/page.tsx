// Post-signup interstitial when Supabase requires email confirmation.
// Lights up automatically once "Confirm email" is ON in the Supabase Auth
// settings — signupAction will redirect here when session is null but a
// user was created.

import Link from "next/link";
import { Mail } from "lucide-react";
import { resendVerificationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = (params.email || "").trim();

  return (
    <div className="min-h-screen grid place-items-center px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        <div className="mx-auto w-12 h-12 grid place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
          <Mail size={22} />
        </div>
        <h1 className="mt-5 text-[24px] font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="mt-2 text-[14px] text-[var(--fg-muted)] leading-relaxed">
          We sent a verification link to{" "}
          {email ? (
            <span className="font-medium text-[var(--fg-primary)]">{email}</span>
          ) : (
            <span>your email</span>
          )}
          . Click the link to activate your account, then come back here to
          sign in.
        </p>

        <div className="mt-6 text-[13px] text-[var(--fg-muted)]">
          Didn&apos;t get it? Check spam, or
        </div>

        <form action={resendVerificationAction} className="mt-2">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            className="text-[13px] text-[var(--accent)] hover:underline"
            disabled={!email}
          >
            Resend verification email
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[var(--border)] text-[13px] text-[var(--fg-muted)]">
          Already verified?{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
