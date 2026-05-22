"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <section className="card card-lg w-full max-w-[420px] p-8">
        <h1 className="text-[22px] font-semibold mb-2">Check your email</h1>
        <p className="text-[13px] text-[var(--fg-muted)] mb-6">
          If an account with that email exists, we&apos;ve sent a reset link.
        </p>
        <Link href="/login" className="btn btn-secondary btn-lg w-full">
          Back to sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="card card-lg w-full max-w-[420px] p-8">
      <h1 className="text-[22px] font-semibold mb-1">Forgot password</h1>
      <p className="text-[13px] text-[var(--fg-muted)] mb-6">
        We&apos;ll email you a link to set a new one.
      </p>

      <form
        action={(formData) =>
          startTransition(async () => {
            await forgotPasswordAction(formData);
            setDone(true);
          })
        }
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            dir="ltr"
            className="input"
            readOnly={pending}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[var(--fg-muted)]">
        Remember it?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </section>
  );
}
