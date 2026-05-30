"use client";

// Pasted-CSV import. Parsed entirely client-side so the user gets instant
// feedback before they commit. Three columns supported, in order:
//
//     url[, label[, cadence]]
//
// Quoted fields with embedded commas are supported. Blank lines + #-comments
// are ignored. A header row is auto-detected and skipped.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Upload,
} from "lucide-react";
import { bulkAddTracksAction, type BulkRow } from "./actions";
import { cn } from "@/lib/cn";

type Cadence = "hourly" | "daily" | "weekly" | "ondemand";
const VALID_CADENCE = new Set(["hourly", "daily", "weekly", "ondemand"]);

type ParsedRow = {
  line: number;
  url: string;
  label: string | null;
  cadence: Cadence;
  error: string | null;
};

const SAMPLE = `# url,label,cadence
https://www.allbirds.com/products/mens-tree-runners,Tree Runner reference,hourly
https://www.allbirds.com/products/mens-tree-dashers,Tree Dasher,hourly
https://kith.com/products/khue1240-001,Kith hoodie watch,daily`;

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedRow[] = [];
  let sawHeader = false;
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    // Parse fields: respects double-quotes, treats `,` as separator.
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          fields.push(cur);
          cur = "";
        } else if (ch === '"') {
          inQuote = true;
        } else {
          cur += ch;
        }
      }
    }
    fields.push(cur);

    const url = (fields[0] || "").trim();
    const label = ((fields[1] ?? "") || "").trim() || null;
    const cadenceRaw = ((fields[2] ?? "hourly") || "hourly").trim().toLowerCase();

    // Auto-detect a header row: first non-comment line whose first cell is
    // literally `url` (case-insensitive).
    if (!sawHeader && url.toLowerCase() === "url") {
      sawHeader = true;
      return;
    }
    sawHeader = true; // any subsequent lines start counting

    let error: string | null = null;
    if (!url) error = "empty URL";
    else if (!/^https?:\/\//i.test(url)) error = "URL must start with http(s)";
    else if (cadenceRaw && !VALID_CADENCE.has(cadenceRaw)) {
      error = `invalid cadence "${cadenceRaw}"`;
    }

    out.push({
      line: idx + 1,
      url,
      label,
      cadence: (VALID_CADENCE.has(cadenceRaw) ? cadenceRaw : "hourly") as Cadence,
      error,
    });
  });
  return out;
}

export function ImportForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [result, setResult] = useState<
    | null
    | {
        kind: "ok";
        inserted: number;
        skipped_duplicates: number;
        failed: Array<{ url: string; error: string }>;
      }
    | { kind: "error"; error: string }
  >(null);

  const parsed = useMemo(() => parseCsv(text), [text]);
  const validRows = parsed.filter((r) => !r.error);
  const invalidRows = parsed.filter((r) => r.error);
  const tooMany = parsed.length > 200;

  function onLoadSample() {
    setText(SAMPLE);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validRows.length === 0 || tooMany || busy) return;
    setResult(null);
    const rows: BulkRow[] = validRows.map((r) => ({
      url: r.url,
      label: r.label,
      cadence: r.cadence,
    }));
    start(async () => {
      const r = await bulkAddTracksAction({ rows });
      if (!r.ok) {
        setResult({ kind: "error", error: r.error });
        return;
      }
      setResult({
        kind: "ok",
        inserted: r.inserted,
        skipped_duplicates: r.skipped_duplicates,
        failed: r.failed,
      });
      if (r.inserted > 0) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <label htmlFor="csv" className="label !mb-0">
            CSV input
          </label>
          <button
            type="button"
            onClick={onLoadSample}
            className="text-[12px] text-[var(--accent)] hover:underline"
          >
            Load sample
          </button>
        </div>
        <textarea
          id="csv"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="input font-mono text-[12.5px] leading-relaxed resize-y"
          placeholder={"# url,label,cadence\nhttps://store.example/product-1,Competitor SKU,hourly\nhttps://store.example/product-2"}
        />
        <p className="helper">
          One row per line. Columns:{" "}
          <code className="font-mono">url</code>,{" "}
          <code className="font-mono">label</code> (optional),{" "}
          <code className="font-mono">cadence</code> (optional, defaults to{" "}
          <code className="font-mono">hourly</code>). Blank lines and{" "}
          <code className="font-mono">#</code>-comments are ignored. A header
          row starting with <code className="font-mono">url</code> is auto-skipped.
        </p>
      </section>

      {parsed.length > 0 && (
        <section className="card p-5">
          <header className="mb-3">
            <h2 className="font-semibold text-[15px]">Preview</h2>
            <p className="text-[12px] text-[var(--fg-muted)] mt-0.5">
              {validRows.length} row{validRows.length === 1 ? "" : "s"} ready ·{" "}
              {invalidRows.length} invalid
              {tooMany && (
                <>
                  {" "}·{" "}
                  <span className="text-[var(--danger)] font-medium">
                    over 200-row limit — trim before submitting
                  </span>
                </>
              )}
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)] border-b border-[var(--border)]">
                  <th className="px-2 py-1.5 text-left w-8">#</th>
                  <th className="px-2 py-1.5 text-left">URL</th>
                  <th className="px-2 py-1.5 text-left">Label</th>
                  <th className="px-2 py-1.5 text-left">Cadence</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 60).map((r) => (
                  <tr
                    key={r.line}
                    className={cn(
                      "border-b border-[var(--border)] last:border-0",
                      r.error && "bg-[var(--danger)]/4",
                    )}
                  >
                    <td className="px-2 py-1.5 text-[var(--fg-muted)] tabular-nums">{r.line}</td>
                    <td className="px-2 py-1.5 font-mono text-[11.5px] truncate max-w-[260px]" title={r.url}>
                      {r.url || <em className="text-[var(--fg-muted)]">empty</em>}
                    </td>
                    <td className="px-2 py-1.5 truncate max-w-[160px]">{r.label || "—"}</td>
                    <td className="px-2 py-1.5">{r.cadence}</td>
                    <td className="px-2 py-1.5">
                      {r.error ? (
                        <span className="inline-flex items-center gap-1 text-[var(--danger)]">
                          <AlertTriangle size={11} />
                          {r.error}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--success)]">
                          <Check size={11} />
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {parsed.length > 60 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-[var(--fg-muted)] text-[12px]">
                      …{parsed.length - 60} more rows hidden in preview but will be imported
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && (
        <section className={cn(
          "card p-4",
          result.kind === "ok"
            ? "border-[var(--success)]/30 bg-[var(--success)]/6"
            : "border-[var(--danger)]/30 bg-[var(--danger)]/6",
        )}>
          {result.kind === "ok" ? (
            <>
              <div className="flex items-center gap-2 font-medium text-[14px] text-[var(--success)]">
                <Check size={14} />
                Imported {result.inserted} new track{result.inserted === 1 ? "" : "s"}
              </div>
              <ul className="mt-2 text-[12.5px] text-[var(--fg-muted)] space-y-0.5">
                {result.skipped_duplicates > 0 && (
                  <li>· {result.skipped_duplicates} duplicate{result.skipped_duplicates === 1 ? "" : "s"} skipped</li>
                )}
                {result.failed.length > 0 && (
                  <li>· {result.failed.length} row{result.failed.length === 1 ? "" : "s"} failed: {result.failed.map((f) => f.error).slice(0, 3).join("; ")}</li>
                )}
              </ul>
              <div className="mt-3 flex gap-2">
                <Link href="/app/tracks" className="btn btn-primary">
                  Open tracks list
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    setResult(null);
                  }}
                  className="btn btn-secondary"
                >
                  Import another batch
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 font-medium text-[14px] text-[var(--danger)]">
                <AlertTriangle size={14} />
                Import failed
              </div>
              <p className="mt-1 text-[12.5px] text-[var(--fg-muted)]">{result.error}</p>
            </>
          )}
        </section>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Link href="/app/tracks" className="btn btn-secondary">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy || validRows.length === 0 || tooMany}
          className="btn btn-primary btn-lg"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Import {validRows.length || ""} track{validRows.length === 1 ? "" : "s"}
        </button>
      </div>
    </form>
  );
}
