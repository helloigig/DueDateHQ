-- ════════════════════════════════════════════════════════════════════════
-- Federal forms catalog + Federal Register change-detection pipeline
--
-- Until now the only "form catalog" we had was `service_templates.formType`
-- as a denormalized text column attached to the 7 federal entries seeded
-- from `seed-data.ts`. AddDeadlineModal carried its own hardcoded
-- COMMON_FORMS list. There was no way to:
--   (a) ask "which federal forms apply to this client?"
--   (b) detect when an IRS form's due date or revision changed,
--   (c) extend the catalog past the curated 7 without dropping a code change.
--
-- This migration introduces a first-class `federal_forms` table that owns
-- the catalog, plus a Federal Register pipeline parallel to the state
-- announcement pipeline:
--
--   federal_forms              — the catalog (curated → LLM-extended)
--   federal_register_notices   — raw notices from the Federal Register API
--                                (audit trail; one row per IRS notice we read)
--   federal_form_change_events — append-only log when a notice plausibly
--                                changes a form (links notice → form)
--   federal_register_sources   — per-source poll freshness, mirrors
--                                state_announcement_sources for parity
--
-- All additive — no destructive changes to existing tables.
-- ════════════════════════════════════════════════════════════════════════

CREATE TYPE "public"."federal_form_status" AS ENUM(
  'active',
  'pending_review',
  'deprecated'
);
--> statement-breakpoint

CREATE TYPE "public"."federal_form_extraction_method" AS ENUM(
  'curated',
  'llm',
  'federal_register'
);
--> statement-breakpoint

CREATE TYPE "public"."federal_register_source_status" AS ENUM(
  'healthy',
  'stale_short',
  'stale_long',
  'broken'
);
--> statement-breakpoint

CREATE TYPE "public"."federal_form_change_kind" AS ENUM(
  'due_date_change',
  'form_revision',
  'new_form',
  'deprecation',
  'instructions_update',
  'other'
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "federal_forms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Canonical form number, e.g. "1040", "1120-S", "941", "1099-NEC".
  -- Globally unique because federal forms are addressed system-wide.
  "form_number" text NOT NULL UNIQUE,
  -- Plain-English name, e.g. "U.S. Individual Income Tax Return".
  "form_name" text NOT NULL,
  -- High-level grouping — drives FilingsTab section headers.
  -- One of: 'income', 'payroll', 'info_return', 'estimated', 'extension',
  -- 'excise', 'estate_gift', 'nonprofit', 'international', 'amendment', 'other'
  "category" text NOT NULL,
  -- Entity types this form applies to. Mirrors clients.entity_type values.
  -- e.g. {"Individual"}, {"S-Corp", "Partnership"}.
  "entity_types" text[] NOT NULL DEFAULT '{}'::text[],
  -- Frequency — annual / quarterly / monthly / per_event.
  "frequency" text NOT NULL DEFAULT 'annual',
  -- Due-date rule, same JSON shape as service_templates.due_date_rule.
  -- Nullable because info-returns like 1099-NEC have due dates that
  -- depend on the recipient (Jan 31 to recipient, Feb 28 paper / Mar 31
  -- e-file to IRS) and we encode that in `notes` rather than the rule.
  "due_date_rule" jsonb,
  -- Free-text notes the FilingsTab tooltip surfaces — caveats, deposit
  -- rules, schedule attachments, etc. Two sentences max.
  "notes" text,
  -- Canonical IRS URL for "where to read about this form."
  "irs_url" text,
  -- How we got this row. 'curated' = hand-written from seed-federal-forms.ts.
  -- 'llm' = produced by federal-form-extractor.ts at request-time. 'federal_register'
  -- = inferred from a Federal Register notice that mentioned a brand-new form.
  "extraction_method" "federal_form_extraction_method" NOT NULL DEFAULT 'curated',
  -- 0..1; only meaningful when extraction_method='llm'. Curated rows = 1.0.
  "confidence_score" numeric(3, 2) NOT NULL DEFAULT 1.0,
  -- 'active' for everyday forms. 'pending_review' for LLM rows whose
  -- confidence < threshold (admin reviews before AddDeadlineModal shows
  -- them). 'deprecated' for retired forms (kept for historical periods
  -- but excluded from new-deadline pickers).
  "status" "federal_form_status" NOT NULL DEFAULT 'active',
  -- Provenance: when the curated value was last verified against IRS.gov,
  -- and when the change-detection poller last touched the row. Distinct
  -- because the poller may run hourly without re-verifying content.
  "last_verified_at" timestamp with time zone,
  "last_change_check_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- The list query filters by entity_types frequently — GIN keeps it cheap
-- as the catalog grows past the curated ~30 toward the 800+ tail.
CREATE INDEX IF NOT EXISTS "federal_forms_entity_types_gin"
  ON "federal_forms" USING gin ("entity_types");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "federal_forms_category_idx"
  ON "federal_forms" ("category");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "federal_forms_status_idx"
  ON "federal_forms" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "federal_register_notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Federal Register's stable doc number, e.g. "2026-12345". UNIQUE so
  -- repeated polls are idempotent — same way the scraper dedupes by URL.
  "document_number" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "abstract" text,
  -- 'Rule', 'Proposed Rule', 'Notice', 'Presidential Document', etc.
  "document_type" text NOT NULL,
  -- IRS / Treasury — the agency_names array the API returns flattened
  -- to the first item we care about.
  "agency" text NOT NULL,
  "publication_date" date NOT NULL,
  -- effective_on isn't on every notice, so it's nullable.
  "effective_date" date,
  "html_url" text NOT NULL,
  "pdf_url" text,
  -- The form numbers we extracted from title + abstract via regex (cheap)
  -- + LLM (when available). Empty array = no form refs detected; the
  -- notice still lands so we have an audit trail of "here's what IRS
  -- published this week."
  "referenced_form_numbers" text[] NOT NULL DEFAULT '{}'::text[],
  -- Best-effort categorization, mirrors federal_form_change_kind. Falls
  -- back to 'other' when the heuristic + LLM both can't decide.
  "change_kind" "federal_form_change_kind" NOT NULL DEFAULT 'other',
  -- 'high'/'medium'/'low' — drives the reviewer queue. Same buckets as
  -- announcements.parse_confidence so the UI can be reused.
  "parse_confidence" text NOT NULL DEFAULT 'medium',
  -- Raw JSON from the Federal Register API for offline re-parsing if
  -- the heuristic improves later.
  "raw_payload" jsonb,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "federal_register_notices_publication_date_idx"
  ON "federal_register_notices" ("publication_date" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "federal_register_notices_referenced_forms_gin"
  ON "federal_register_notices" USING gin ("referenced_form_numbers");
--> statement-breakpoint

-- Append-only log connecting a notice to a form it likely changed.
-- One notice can touch multiple forms; one form can be touched by many
-- notices over time. The reviewer queue reads from here joined with
-- federal_register_notices for context.
CREATE TABLE IF NOT EXISTS "federal_form_change_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "form_id" uuid NOT NULL REFERENCES "federal_forms"("id") ON DELETE cascade,
  "notice_id" uuid NOT NULL REFERENCES "federal_register_notices"("id") ON DELETE cascade,
  "change_kind" "federal_form_change_kind" NOT NULL,
  -- One-line plain-English summary, e.g. "Form 941 due date moved
  -- from Apr 30 to May 14 in disaster areas."
  "summary" text NOT NULL,
  -- Reviewer (firm-side admin) marks reviewed / accepted; null = pending.
  "reviewed_at" timestamp with time zone,
  -- Set when the change was applied to the form row (e.g., due_date_rule
  -- updated). Null = noted but not yet rolled into the catalog.
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "federal_form_change_events_form_notice_uniq"
  ON "federal_form_change_events" ("form_id", "notice_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "federal_form_change_events_unreviewed_idx"
  ON "federal_form_change_events" ("created_at" DESC)
  WHERE "reviewed_at" IS NULL;
--> statement-breakpoint

-- Per-source freshness for the Federal Register poller. Mirrors
-- state_announcement_sources so /api/scraper/status can render both
-- without special-casing.
CREATE TABLE IF NOT EXISTS "federal_register_sources" (
  "source_key" text PRIMARY KEY,
  "label" text NOT NULL,
  "endpoint_url" text NOT NULL,
  "last_polled_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_error_message" text,
  "consecutive_error_count" integer NOT NULL DEFAULT 0,
  "next_scheduled_poll_at" timestamp with time zone,
  "status" "federal_register_source_status" NOT NULL DEFAULT 'healthy',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
