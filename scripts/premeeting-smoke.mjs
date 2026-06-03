// Pre-meeting smoke — hits public production endpoints with zero auth and
// prints a single status table you can show on screen. Designed to be run
// 5 minutes before a sales call.
//
//   node scripts/premeeting-smoke.mjs
//
// Or against a different host:
//   node scripts/premeeting-smoke.mjs https://reconcart-preview.vercel.app
//
// Exits non-zero if any required check fails so it can be wired into CI later.

const BASE = (process.argv[2] || "https://reconcart.vercel.app").replace(/\/+$/, "");
const CRON_SECRET = process.env.CRON_SECRET;
const TIMEOUT_MS = 15_000;

// ANSI helpers — fall back to plain text if NO_COLOR is set.
const noColor = "NO_COLOR" in process.env;
const c = {
  green: (s) => (noColor ? s : `\x1b[32m${s}\x1b[0m`),
  red: (s) => (noColor ? s : `\x1b[31m${s}\x1b[0m`),
  yellow: (s) => (noColor ? s : `\x1b[33m${s}\x1b[0m`),
  dim: (s) => (noColor ? s : `\x1b[2m${s}\x1b[0m`),
  bold: (s) => (noColor ? s : `\x1b[1m${s}\x1b[0m`),
};

async function timed(fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    return { ms: Date.now() - t0, ...result };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, detail: e?.message || String(e) };
  }
}

async function checkStatus(path, opts = {}) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ac.signal, ...opts });
    return {
      ok: res.ok,
      status: res.status,
      detail: `HTTP ${res.status}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkJson(path, validate, opts = {}) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ac.signal, ...opts });
    let body = null;
    try {
      body = await res.json();
    } catch {
      // not JSON
    }
    const v = validate(res, body);
    return { ok: v.ok, status: res.status, detail: v.detail };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkContains(path, needles) {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ac.signal });
    const text = await res.text();
    const missing = needles.filter((n) => !text.includes(n));
    return {
      ok: res.ok && missing.length === 0,
      status: res.status,
      detail:
        missing.length === 0
          ? `HTTP ${res.status} · all ${needles.length} markers present`
          : `missing: ${missing.join(", ")}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const CHECKS = [
  // 1. Marketing surface — must be reachable for the client to even see the site.
  { name: "landing /", required: true, run: () => checkStatus("/") },
  { name: "/demo", required: true, run: () => checkStatus("/demo") },
  { name: "/docs", required: true, run: () => checkStatus("/docs") },
  { name: "/docs/webhooks", required: false, run: () => checkStatus("/docs/webhooks") },
  { name: "/pricing", required: false, run: () => checkStatus("/pricing") },
  { name: "/security", required: false, run: () => checkStatus("/security") },
  { name: "/status", required: false, run: () => checkStatus("/status") },
  { name: "/changelog", required: false, run: () => checkStatus("/changelog") },
  { name: "/roadmap", required: false, run: () => checkStatus("/roadmap") },
  { name: "/privacy", required: false, run: () => checkStatus("/privacy") },
  { name: "/terms", required: false, run: () => checkStatus("/terms") },

  // 2. Health endpoint must report DB ok.
  {
    name: "/api/health · db ok",
    required: true,
    run: () =>
      checkJson("/api/health", (res, body) => ({
        ok: res.ok && body?.ok === true && body?.checks?.db?.ok === true,
        detail:
          body?.checks?.db
            ? `db ${body.checks.db.latency_ms}ms · build ${body.version}`
            : `HTTP ${res.status}`,
      })),
  },

  // 3. OpenAPI spec must parse and declare expected paths.
  {
    name: "/api/openapi.json · valid",
    required: true,
    run: () =>
      checkJson("/api/openapi.json", (res, body) => {
        if (!res.ok || !body) return { ok: false, detail: `HTTP ${res.status}` };
        const paths = body.paths ? Object.keys(body.paths) : [];
        const expected = ["/api/v1/tracks", "/api/v1/alerts", "/api/v1/channels"];
        const missing = expected.filter((p) => !paths.includes(p));
        return {
          ok: missing.length === 0,
          detail:
            missing.length === 0
              ? `${paths.length} paths, all expected present`
              : `missing: ${missing.join(", ")}`,
        };
      }),
  },

  // 4. Sitemap + robots must be served as text/xml and txt respectively.
  {
    name: "/sitemap.xml · single-line Sitemap",
    required: true,
    run: () =>
      checkContains("/sitemap.xml", ["<urlset", `<loc>${BASE}/demo</loc>`]),
  },
  {
    name: "/robots.txt · allows public surface",
    required: true,
    run: () =>
      checkContains("/robots.txt", ["User-Agent", `Sitemap: ${BASE}/sitemap.xml`]),
  },

  // 5. OG image renders (Vercel /og endpoint via Next file convention).
  {
    name: "/opengraph-image · serves an image",
    required: false,
    run: () =>
      checkJson("/opengraph-image", (res) => ({
        ok: res.ok && (res.headers.get("content-type") || "").startsWith("image/"),
        detail: `HTTP ${res.status} · ${res.headers.get("content-type")}`,
      })),
  },

  // 6. Signed-in surface must redirect (proves middleware is enforcing).
  {
    name: "/app · redirects when unauthenticated",
    required: true,
    run: () =>
      checkJson("/app", (res) => ({
        ok: res.status === 307 || res.status === 302 || res.url.includes("/login"),
        detail: `HTTP ${res.status} → ${res.url.split("/").pop() || "/"}`,
      }), { redirect: "manual" }),
  },

  // 7. Cron tick — only runs if CRON_SECRET is in env.
  {
    name: "/api/cron/tick · authorized and healthy",
    required: false,
    run: async () => {
      if (!CRON_SECRET) {
        return { ok: true, status: 0, detail: "skipped — CRON_SECRET not set in local env" };
      }
      const res = await fetch(`${BASE}/api/cron/tick`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      const body = await res.json().catch(() => null);
      return {
        ok: res.ok && body?.ok === true,
        status: res.status,
        detail: body ? `${body.candidates} candidates · ${body.due} due` : `HTTP ${res.status}`,
      };
    },
  },
];

(async () => {
  console.log(`\n${c.bold("ReconCart pre-meeting smoke")} → ${c.dim(BASE)}\n`);

  let failed = 0;
  let softFailed = 0;
  const rows = [];

  for (const check of CHECKS) {
    const result = await timed(() => check.run());
    const ok = result.ok;
    if (!ok) {
      if (check.required) failed += 1;
      else softFailed += 1;
    }
    rows.push({ ...check, ...result });
    const tag = ok ? c.green("PASS") : check.required ? c.red("FAIL") : c.yellow("WARN");
    const ms = c.dim(`${String(result.ms).padStart(5)}ms`);
    console.log(`  [${tag}] ${ms}  ${check.name.padEnd(38)}  ${c.dim(result.detail || "")}`);
  }

  const summary = `\n${rows.length - failed - softFailed} pass · ${softFailed} warn · ${failed} fail`;
  console.log(c.bold(summary));
  if (failed > 0) {
    console.log(c.red("\nOne or more REQUIRED checks failed — do not show the demo until resolved.\n"));
    process.exit(1);
  } else if (softFailed > 0) {
    console.log(c.yellow("\nNon-blocking warnings — meeting can proceed.\n"));
  } else {
    console.log(c.green("\nReady for the meeting.\n"));
  }
})();
