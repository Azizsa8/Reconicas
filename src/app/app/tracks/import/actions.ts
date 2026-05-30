"use server";

// Bulk track-import server action. Accepts an array of parsed rows from the
// client, dedups against the tenant's existing tracks, and inserts the
// survivors in a single round-trip. No per-row scrape — the cron will pick
// them up on the next tick. (Pre-flight scraping each URL would dominate
// the request budget at any meaningful batch size.)

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { canonicalizeUrl } from "@/lib/url";
import { logAudit } from "@/lib/audit";

export type BulkRow = {
  url: string;
  label?: string | null;
  cadence?: "hourly" | "daily" | "weekly" | "ondemand";
};

export type BulkResult = {
  ok: true;
  inserted: number;
  skipped_duplicates: number;
  failed: Array<{ url: string; error: string }>;
} | { ok: false; error: string };

const VALID_CADENCES = new Set(["hourly", "daily", "weekly", "ondemand"]);
const MAX_ROWS = 200;

export async function bulkAddTracksAction(input: { rows: BulkRow[] }): Promise<BulkResult> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const tenant = await getActiveTenant();
  if (!tenant) return { ok: false, error: "No workspace found." };

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: "No rows to import." };
  }
  if (input.rows.length > MAX_ROWS) {
    return { ok: false, error: `Maximum ${MAX_ROWS} rows per import.` };
  }

  // Snapshot tenant's existing URLs once so dedup is O(N) not O(N²).
  const { data: existing } = await supabase
    .from("tracks")
    .select("url")
    .eq("tenant_id", tenant.id);
  const existingCanonical = new Set(
    (existing ?? []).map((r) => canonicalizeUrl(r.url)),
  );

  // Pre-classify each row in memory.
  const toInsert: Array<{ url: string; intent: string | null; cadence: string }> = [];
  const failed: Array<{ url: string; error: string }> = [];
  let skippedDuplicates = 0;
  const seenInBatch = new Set<string>();

  for (const raw of input.rows) {
    const url = (raw.url || "").trim();
    if (!url) {
      failed.push({ url: "", error: "empty URL" });
      continue;
    }
    if (!/^https?:\/\//.test(url)) {
      failed.push({ url, error: "URL must start with http:// or https://" });
      continue;
    }
    const cadence = raw.cadence ?? "hourly";
    if (!VALID_CADENCES.has(cadence)) {
      failed.push({ url, error: `invalid cadence: ${cadence}` });
      continue;
    }
    const canonical = canonicalizeUrl(url);
    if (existingCanonical.has(canonical) || seenInBatch.has(canonical)) {
      skippedDuplicates++;
      continue;
    }
    seenInBatch.add(canonical);
    toInsert.push({
      url,
      intent: (raw.label ?? "").trim() || null,
      cadence,
    });
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => ({
      tenant_id: tenant.id,
      url: r.url,
      intent: r.intent,
      cadence: r.cadence,
    }));
    const { data, error } = await supabase
      .from("tracks")
      .insert(rows)
      .select("id, url");
    if (error) {
      // 23505 here can hit if a concurrent import added the same URL between
      // our SELECT and INSERT. Surface as a partial failure rather than
      // dropping everything.
      if (error.code === "23505") {
        return {
          ok: true,
          inserted: 0,
          skipped_duplicates: skippedDuplicates + toInsert.length,
          failed,
        };
      }
      return { ok: false, error: error.message };
    }
    inserted = data?.length ?? 0;

    // Audit one row per inserted track. Keep payload tight; full URLs are in
    // the metadata so a forensic trail is reconstructable later.
    for (const t of data ?? []) {
      await logAudit(supabase, {
        action: "track.create",
        target_kind: "track",
        target_id: t.id,
        tenant_id: tenant.id,
        metadata: { url: t.url, via: "bulk_import" },
      });
    }
  }

  revalidatePath("/app/tracks");
  revalidatePath("/app");

  return { ok: true, inserted, skipped_duplicates: skippedDuplicates, failed };
}
