-- ReconCart 2026-05-30 — alert deduplication + minor schema additions.
--
-- Why:
--   - conditions.last_fired_at + suppress_seconds: avoids "price < 30" firing
--     every scrape while the condition holds. Defaults to 24h suppression.
--     Existing transition conditions ("was_in_stock and not is_in_stock")
--     self-dedupe via state change so the default doesn't hurt them.
--
-- How to apply:
--   Paste into Supabase SQL Editor and click Run. Idempotent.

ALTER TABLE public.conditions
  ADD COLUMN IF NOT EXISTS last_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS suppress_seconds integer NOT NULL DEFAULT 86400;

-- Index supports the engine's "skip suppressed" filter at scale.
CREATE INDEX IF NOT EXISTS idx_conditions_track_lastfired
  ON public.conditions (track_id, last_fired_at);
