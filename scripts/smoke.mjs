// End-to-end Supabase + RLS smoke test.
// 1. signUp a fresh test user
// 2. Verify session is established (= email confirmation OFF, as expected)
// 3. Insert a tenant row and a membership (replicates signupAction)
// 4. Sign out
// 5. signIn with the same credentials
// 6. Read the tenant back (verifies RLS lets the owner see their own)
// 7. Verify a *different* anonymous client cannot read the tenant (RLS isolation)
import { createClient } from "@supabase/supabase-js";

// Pulled from environment — run with:
//   vercel env pull .env.local && node --env-file=.env.local scripts/smoke.mjs
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://olsqrtqmxkxmlaiyqqlg.supabase.co";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_ZBPvpf8CyiIIK7kGGJ2ssQ_FUmY8iWl";

function unique(suffix = "") {
  const n = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return suffix ? `${n}.${suffix}` : n;
}

function ok(label, cond, detail = "") {
  const tag = cond ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${label}${detail ? " — " + detail : ""}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const supa = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Some Supabase projects reject novel TLDs and + addressing — use a vanilla one.
  const email = `smoke${unique()}@gmail.com`;
  const password = "SmokeTest!9plus" + unique();
  const workspaceName = "Smoke Workshop";

  console.log("=== Reconcart smoke test ===");
  console.log("  user:", email);

  // 1. signUp
  const { data: signup, error: e1 } = await supa.auth.signUp({
    email,
    password,
    options: { data: { workspace_display_name: workspaceName } },
  });
  ok("signUp succeeded", !e1 && !!signup?.user, e1?.message);
  ok(
    "session established (email confirmation OFF)",
    !!signup?.session,
    signup?.session ? `access_token ${signup.session.access_token.slice(0, 20)}…` : "no session — toggle off Confirm Email"
  );
  if (!signup?.session) {
    console.log("\n⚠ Stopping — auth setting blocks the rest of the test.");
    return;
  }

  // 2. Insert a tenant
  const slug = `smoke-${unique()}`.slice(0, 50);
  const { data: tenant, error: e2 } = await supa
    .from("tenants")
    .insert({
      slug,
      display_name: workspaceName,
      owner_user_id: signup.user.id,
    })
    .select()
    .single();
  ok("insert tenants (RLS allows owner)", !e2 && !!tenant, e2?.message);

  // 3. Insert membership
  const { error: e3 } = await supa.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: signup.user.id,
    role: "admin",
  });
  ok("insert memberships", !e3, e3?.message);

  // 4. Sign out
  await supa.auth.signOut();

  // 5. Sign in
  const { data: signin, error: e4 } = await supa.auth.signInWithPassword({
    email,
    password,
  });
  ok("signIn with same credentials", !e4 && !!signin?.session, e4?.message);

  // 6. Read tenant back
  const { data: myTenants, error: e5 } = await supa
    .from("tenants")
    .select("id, slug, display_name");
  ok(
    "RLS lets owner read own tenant",
    !e5 && Array.isArray(myTenants) && myTenants.some((t) => t.id === tenant.id),
    e5?.message || `got ${myTenants?.length || 0} tenants`
  );

  // 7. Anonymous client should see NOTHING (RLS isolation)
  const anonSupa = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: anonTenants } = await anonSupa
    .from("tenants")
    .select("id");
  ok(
    "RLS hides tenant from anonymous client",
    Array.isArray(anonTenants) && anonTenants.length === 0,
    `anon got ${anonTenants?.length ?? "?"} rows`
  );

  // 8. Smoke check the live URLs
  for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
    const r = await fetch("https://reconcart.vercel.app" + path);
    ok(`GET ${path} returns 200`, r.status === 200, `got ${r.status}`);
  }

  // 9. /app should redirect unauthenticated → /login
  const appRes = await fetch("https://reconcart.vercel.app/app", {
    redirect: "manual",
  });
  ok(
    "/app unauthenticated → 307 to /login",
    appRes.status === 307 && appRes.headers.get("location")?.includes("/login"),
    `got ${appRes.status} ${appRes.headers.get("location") || ""}`
  );

  console.log("\nDONE.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
