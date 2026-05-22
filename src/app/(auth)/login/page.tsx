"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction, type AuthResult } from "../actions";
import { GoogleOAuthButton, PasswordInput } from "../_components";

export default function LoginPage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);

  return (
    <section
      className="card card-lg w-full max-w-[420px] p-8"
      aria-labelledby="login-heading"
    >
      <h1 id="login-heading" className="text-[22px] font-semibold mb-1">
        Sign in
      </h1>
      <p className="text-[13px] text-[var(--fg-muted)] mb-6">Welcome back.</p>

      {result && !result.ok && (
        <div
          role="alert"
          aria-live="polite"
          className="banner banner-danger mb-4"
        >
          {result.error}
        </div>
      )}

      <form
        action={(formData) =>
          startTransition(async () => {
            const r = await loginAction(formData);
            setResult(r);
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

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[12px] text-[var(--fg-muted)] hover:text-[var(--accent)]"
            >
              Forgot?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[var(--fg-primary)]">
          <input
            type="checkbox"
            name="remember"
            className="size-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span>Remember me for 30 days</span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
          disabled={pending}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="divider-or">or</div>

      <GoogleOAuthButton disabled={pending} />

      <p className="mt-6 text-center text-[13px] text-[var(--fg-muted)]">
        New here?{" "}
        <Link
          href="/signup"
          className="text-[var(--accent)] hover:underline font-medium"
        >
          Create one
        </Link>
      </p>
    </section>
  );
}
