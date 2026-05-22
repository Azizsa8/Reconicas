"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function GoogleGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 18 18"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.183l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function PasswordInput({
  name,
  id,
  required,
  autoComplete,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
  onValueChange,
}: {
  name: string;
  id: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onValueChange?: (value: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="input pe-10"
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => onValueChange?.(e.currentTarget.value)}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg-primary)] rounded"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export function PasswordStrengthMeter({ value }: { value: string }) {
  const score = scorePassword(value);
  const label = score === 0 ? "" : score === 1 ? "weak" : score === 2 ? "ok" : "strong";
  const color =
    score === 0
      ? "transparent"
      : score === 1
      ? "var(--danger)"
      : score === 2
      ? "var(--warning)"
      : "var(--success)";
  return (
    <div className="mt-2 flex items-center gap-2" aria-hidden={value.length === 0}>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${(score / 3) * 100}%`, background: color }}
        />
      </div>
      <span className="text-xs text-[var(--fg-muted)] w-12 text-right">{label}</span>
    </div>
  );
}

function scorePassword(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s === 0 ? 1 : (s as 1 | 2 | 3);
}

export function GoogleOAuthButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const supabase = getBrowserSupabase();
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${origin}/auth/callback` },
          });
        })
      }
      className="btn btn-secondary btn-lg w-full"
    >
      <GoogleGlyph />
      <span>{pending ? "Waiting for Google…" : "Continue with Google"}</span>
    </button>
  );
}
