-- ════════════════════════════════════════════════════════════════════════
-- Google Calendar integration — Phase 1 push-only sync.
--
-- Adds:
--   integrations.kind enum value 'google_calendar' so OAuth tokens for
--                                  Google Calendar can be persisted with
--                                  the existing integrations row shape.
--                                  Reuses GMAIL_CLIENT_ID/_SECRET env
--                                  vars (same Google OAuth client) but
--                                  with a calendar-only scope, so a CPA
--                                  can connect Calendar WITHOUT granting
--                                  Gmail read access.
--
--   deadlines.calendar_event_id  — nullable text. When the calendar
--                                  sync pushes a deadline as a Google
--                                  Calendar event, the event id is
--                                  stored here so subsequent syncs can
--                                  update / delete the same event
--                                  without producing duplicates.
--
--   deadlines.calendar_synced_at — nullable timestamptz. Drives the
--                                  Settings → Integrations status
--                                  line ("X of Y deadlines synced")
--                                  and the 4h cron's "what's stale"
--                                  query.
--
-- Both deadline columns are additive + nullable; no destructive changes.
-- ════════════════════════════════════════════════════════════════════════

-- Postgres can't drop and recreate enums with dependent columns in the
-- same migration without doing a multi-step dance. Use ALTER TYPE which
-- is supported when the new value is appended.
ALTER TYPE "integration_kind" ADD VALUE IF NOT EXISTS 'google_calendar';

ALTER TABLE "deadlines"
  ADD COLUMN IF NOT EXISTS "calendar_event_id" text;

ALTER TABLE "deadlines"
  ADD COLUMN IF NOT EXISTS "calendar_synced_at" timestamptz;

-- Index supports the cron-tick query "find deadlines for this firm
-- where calendar_synced_at is older than the deadline's updatedAt"
-- (i.e. anything modified since the last push).
CREATE INDEX IF NOT EXISTS "deadlines_firm_calendar_synced_idx"
  ON "deadlines" ("firm_id", "calendar_synced_at" NULLS FIRST);
