"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { markAllReadAction } from "./_actions";

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => start(async () => { await markAllReadAction(); })}
      className="btn btn-secondary"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      Mark all read
    </button>
  );
}
