-- Track redundant scrape sources per canonical announcement row.
--
-- The HTML scraper at backend/src/lib/scraper.ts often emits multiple
-- notices from a single state newsroom page — same article linked from
-- different anchor positions, or near-duplicate IRS-passthrough press
-- releases. Title-fingerprint dedup at insert keeps the DB clean (one
-- canonical row per (state, type, normalized-title)), but we still want
-- an audit trail of every URL that landed at the canonical row, so the
-- frontend banner's tooltip can show "this event was confirmed at N
-- sources" honestly instead of guessing from cluster size.
--
-- NULL-safe default: empty array means "no extra sources beyond
-- source_url itself." Existing rows backfill to '{}'.
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS related_source_urls text[] NOT NULL
  DEFAULT '{}'::text[];
