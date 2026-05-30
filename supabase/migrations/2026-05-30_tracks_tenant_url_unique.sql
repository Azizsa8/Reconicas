-- ReconCart 2026-05-30 — UNIQUE(tenant_id, url) on tracks.
--
-- Closes the race-window where two simultaneous submissions of the same URL
-- could both pass the application-level dedup in addTrackAction (since each
-- runs its SELECT before either INSERT commits). Application-layer
-- canonicalization is the primary defense; this constraint is the safety net.
--
-- Note: the constraint compares the raw `url` column (not the canonical
-- form), so two URLs that canonicalize to the same string but differ in
-- exact characters (e.g. with vs without trailing slash) can still both
-- land in the table. The application-layer dedup handles the canonical
-- case; this constraint catches only exact-string races (e.g. double
-- clicks of "Save track").
--
-- How to apply: paste this file into the Supabase SQL Editor and click Run.
-- Project: https://supabase.com/dashboard/project/olsqrtqmxkxmlaiyqqlg/sql/new
-- Idempotent — safe to re-run.

-- Step 1 — dedup any pre-existing exact-string duplicates, keeping the
-- oldest row (lowest id) per (tenant_id, url) pair. Cascading deletes on
-- scrapes/conditions/alerts/deliveries will clean up the orphans.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, url
      ORDER BY id ASC
    ) AS rn
  FROM public.tracks
)
DELETE FROM public.tracks
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2 — add the unique constraint if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tracks_tenant_url_unique'
      AND conrelid = 'public.tracks'::regclass
  ) THEN
    ALTER TABLE public.tracks
      ADD CONSTRAINT tracks_tenant_url_unique UNIQUE (tenant_id, url);
  END IF;
END $$;
