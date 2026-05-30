// Structured logger. Emits one JSON object per line so any log collector
// (Vercel default, Datadog, Sentry, Logflare) can parse fields without
// regex-fighting console.log strings.
//
// Usage:
//   log.info("scrape.complete", { track_id: 42, elapsed_ms: 217, ok: true });
//   log.error("dispatch.failed", { channel_id: 7, error: e.message });
//
// Schema per line: { ts, level, event, ...ctx, error? }
//
// Notes:
//   - Use a short dotted-namespace `event` string (scrape.complete,
//     cron.tick, dispatch.failed). Easy to filter on later.
//   - Pass an error object via { error } — we stringify the message and
//     name so the log line stays single-line JSON.
//   - Don't put PII in ctx — emails, names, etc. should be referenced by
//     user_id or alert_id, never inlined.

type Level = "debug" | "info" | "warn" | "error";

type LogLine = {
  ts: string;
  level: Level;
  event: string;
  [key: string]: unknown;
};

function flatten(ctx: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, event: string, ctx?: Record<string, unknown>): void {
  const line: LogLine = {
    ts: new Date().toISOString(),
    level,
    event,
    ...flatten(ctx),
  };
  // Single line, no formatting — Vercel and most collectors parse this as JSON.
  const text = JSON.stringify(line);
  if (level === "error") {
    process.stderr.write(text + "\n");
  } else {
    process.stdout.write(text + "\n");
  }
}

export const log = {
  debug: (event: string, ctx?: Record<string, unknown>) => emit("debug", event, ctx),
  info: (event: string, ctx?: Record<string, unknown>) => emit("info", event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => emit("warn", event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => emit("error", event, ctx),
};
