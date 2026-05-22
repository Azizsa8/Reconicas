"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signupAction, type AuthResult } from "../actions";
import {
  GoogleOAuthButton,
  PasswordInput,
  PasswordStrengthMeter,
} from "../_components";

export default function SignupPage() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AuthResult | null>(null);
  const [password, setPassword] = useState("");

  return (
    <section
      className="card card-lg w-full max-w-[420px] p-8"
      aria-labelledby="signup-heading"
    >
      <h1 id="signup-heading" className="text-[22px] font-semibold mb-1">
        Create your account
      </h1>
      <p className="text-[13px] text-[var(--fg-muted)] mb-6">
        3 tracks free. No card required.
      </p>

      {result && !result.ok && !result.field && (
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
            const r = await signupAction(formData);
            // Server action redirects on success; we only get here on error.
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
            aria-invalid={result && !result.ok && result.field === "email" ? true : undefined}
            aria-describedby={result && !result.ok && result.field === "email" ? "email-error" : undefined}
            readOnly={pending}
          />
          {result && !result.ok && result.field === "email" && (
            <p id="email-error" className="helper-error" role="alert">
              {result.error}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            placeholder="At least 10 characters"
            ariaInvalid={result?.ok === false && result.field === "password"}
            ariaDescribedBy="password-strength"
            onValueChange={setPassword}
          />
          <PasswordStrengthMeter value={password} />
          {result && !result.ok && result.field === "password" && (
            <p className="helper-error" role="alert">
              {result.error}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="workspace" className="label">
            Workspace name
          </label>
          <input
            id="workspace"
            name="workspace"
            type="text"
            required
            placeholder="My store"
            className="input"
            aria-invalid={result && !result.ok && result.field === "workspace" ? true : undefined}
            readOnly={pending}
          />
          {result && !result.ok && result.field === "workspace" && (
            <p className="helper-error" role="alert">
              {result.error}
            </p>
          )}
        </div>

        <label className="flex items-start gap-2 text-[13px] text-[var(--fg-primary)]">
          <input
            type="checkbox"
            name="terms"
            required
            className="mt-0.5 size-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            (KSA PDPL compliant).
          </span>
        </label>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
          disabled={pending}
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="divider-or">or</div>

      <GoogleOAuthButton disabled={pending} />

      <p className="mt-6 text-center text-[13px] text-[var(--fg-muted)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[var(--accent)] hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </section>
  );
}
