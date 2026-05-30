// Auth middleware: refresh sessions on every request, gate /app/* behind auth.
// Also stamps security headers on every response (CSP, frame-ancestors, etc).
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Security headers applied to every response. Tuned so Next.js hydration +
// Supabase client + external product image CDNs all work.
//
// Notes on the CSP compromises:
//   - script-src includes 'unsafe-inline' because Next embeds hydration data
//     as inline JSON; nonces would require per-request rendering and aren't
//     wired (would be a follow-up if we tighten further).
//   - style-src 'unsafe-inline' is required by Tailwind 4 + various
//     icon libraries that inject CSS.
//   - img-src https: is permissive for product thumbnails from arbitrary
//     storefronts (Shopify CDN, Allbirds, Salla, Zid, etc).
function applySecurityHeaders(res: NextResponse): NextResponse {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  // HSTS — Vercel sets this for verified TLS-only domains by default, but
  // setting it here doesn't hurt and helps when serving on a custom domain.
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  return res;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Without Supabase configured we still let the app render — useful before
    // the env vars are set in Vercel.
    return applySecurityHeaders(response);
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAppPath = path.startsWith("/app") || path.startsWith("/onboarding");
  const isAuthPath =
    path === "/login" || path === "/signup" || path === "/forgot-password";

  // Not signed in and trying to use app → redirect to /login
  if (!user && isAppPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  // Signed in and on auth pages → bounce to dashboard
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
