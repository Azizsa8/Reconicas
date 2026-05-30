"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { challengeMfaAction } from "../actions";

export function MfaChallengeForm({ factorId }: { factorId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    start(async () => {
      const r = await challengeMfaAction({ factor_id: factorId, code });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label htmlFor="mfa-challenge-code" className="label">
          Verification code
        </label>
        <input
          id="mfa-challenge-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
          autoComplete="one-time-code"
          className="input font-mono text-[20px] text-center tracking-[0.4em]"
          placeholder="000000"
        />
      </div>
      {error && <div className="helper-error">{error}</div>}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="btn btn-primary btn-lg w-full"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Verify and continue
      </button>
    </form>
  );
}
