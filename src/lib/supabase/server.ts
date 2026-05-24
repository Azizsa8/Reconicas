// Server-side Supabase client (Server Components, Server Actions, Route Handlers).
// Cookie store is read from next/headers.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // New Supabase key naming (sb_publishable_*) with fallback to legacy anon JWT.
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Signal to callers (auth actions) that Supabase isn't wired yet — they
    // turn this into a friendly inline banner instead of a 500.
    const err = new Error("SUPABASE_NOT_CONFIGURED");
    (err as Error & { code?: string }).code = "SUPABASE_NOT_CONFIGURED";
    throw err;
  }
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Read-only context (Server Component during render) — silent.
        }
      },
    },
  });
}
