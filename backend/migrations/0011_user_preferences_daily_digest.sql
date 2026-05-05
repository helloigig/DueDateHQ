-- ════════════════════════════════════════════════════════════════════════
-- Daily AM digest — per-user settings + send-history audit.
--
-- Adds:
--   users.preferences         — jsonb. Single source of truth for
--                                user-scoped UI prefs. The daily-digest
--                                schema lives at:
--                                  preferences.dailyDigest = {
--                                    enabled: boolean,
--                                    sendHour: 0-23  (in user's tz),
--                                    days: ["mon","tue","wed","thu","fri"]
--                                  }
--                                Absent / null preferences => disabled.
--
--   daily_digest_runs         — one row per send attempt. Drives:
--                                (1) dedupe via UNIQUE(user_id, local_date)
--                                (2) operator audit trail
--                                (3) trend dashboards in /settings/ai
--
--                                local_date stores the user-local
--                                YYYY-MM-DD when we sent, NOT UTC. A
--                                CPA in NY and one in LA will have
--                                different local_date values for the
--                                same UTC moment, which is exactly
--                                what we want for dedupe.
--
-- All additive. Re-runnable.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Default-on for the daily digest. Backfill existing rows so the
-- intent is explicit at the data layer (not just in the scheduler's
-- in-memory fallback). Future user inserts get this same default
-- when auth.bootstrap runs — see backend/src/trpc/routers/auth.ts.
--
-- Idempotent: only writes rows where the dailyDigest key is missing,
-- so a re-run after a user has opted out won't flip them back on.
UPDATE "users"
SET "preferences" = jsonb_set(
  COALESCE("preferences", '{}'::jsonb),
  '{dailyDigest}',
  '{"enabled":true,"sendHour":7,"days":["mon","tue","wed","thu","fri"]}'::jsonb,
  true
)
WHERE NOT ("preferences" ? 'dailyDigest');

-- Going forward, the column default also seeds new users with the
-- daily-digest payload so insert-then-update isn't required.
ALTER TABLE "users"
  ALTER COLUMN "preferences" SET DEFAULT
  '{"dailyDigest":{"enabled":true,"sendHour":7,"days":["mon","tue","wed","thu","fri"]}}'::jsonb;

CREATE TABLE IF NOT EXISTS "daily_digest_runs" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "firm_id"        uuid NOT NULL REFERENCES "firms"("id") ON DELETE CASCADE,
  "sent_at"        timestamptz NOT NULL DEFAULT now(),
  "local_date"     date NOT NULL,
  "urgent_count"   integer NOT NULL DEFAULT 0,
  "alerts_count"   integer NOT NULL DEFAULT 0,
  "replies_count"  integer NOT NULL DEFAULT 0,
  -- 'sent'              — email accepted by provider
  -- 'skipped_quiet'     — payload empty, no email sent
  -- 'skipped_disabled'  — user opted out (defensive; we filter earlier)
  -- 'failed'            — provider rejected; error_message has details
  "status"         text NOT NULL,
  "error_message"  text,
  "email_id"       text,
  CONSTRAINT "daily_digest_runs_user_local_date_unique"
    UNIQUE ("user_id", "local_date")
);

CREATE INDEX IF NOT EXISTS "daily_digest_runs_firm_sent_at_idx"
  ON "daily_digest_runs" ("firm_id", "sent_at" DESC);
