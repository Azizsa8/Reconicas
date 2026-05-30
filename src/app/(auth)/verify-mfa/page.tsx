// Login-time MFA challenge. Shown when the user has a verified TOTP factor
// but their session is still AAL1 (just signed in with password). The
// /app layout redirects here automatically.

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function VerifyMfaPage() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Already at AAL2? Nothing to do — bounce to the app.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === "aal2") redirect("/app");

  // Find the user's first verified TOTP factor.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.all ?? []).find(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );
  if (!verified) {
    // No verified factor → they shouldn't be on this page. Send them home.
    redirect("/app");
  }

  return (
    <div className="card card-lg p-6 w-full max-w-[420px]">
      <h1 className="text-[20px] font-semibold tracking-tight">Two-factor verification</h1>
      <p className="mt-1.5 text-[13px] text-[var(--fg-muted)] leading-relaxed">
        Enter the 6-digit code from your authenticator app to finish signing in.
      </p>
      <MfaChallengeForm factorId={verified.id} />
    </div>
  );
}
