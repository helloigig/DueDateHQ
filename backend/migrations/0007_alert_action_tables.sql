-- ════════════════════════════════════════════════════════════════════════
-- Alert action tables — backend support for the 5 non-disaster alert types
--
-- Companion to docs/specs/alert-detail-{penalty-relief,pte-change,rate-change,
-- form-change,nexus-change}.md.
--
-- This migration introduces:
--
--   client_tags           — penalty_relief annotation surface; tag clients
--                           for filing-time review with expiry + lifecycle.
--   planning_calls        — pte_change conversational surface; one row per
--                           proposed/scheduled/completed planning call.
--   client_state_nexus    — nexus_change discovery surface; per-client per-
--                           state nexus status with audit trail.
--   nexus_questionnaire_runs — answers to the per-state nexus check
--                           questionnaire; immutable once submitted.
--
-- And adds columns to existing tables:
--
--   clients.pte_election_year, pte_eligibility_status, estimated_state_revenue
--   deadlines.amount, original_amount, estimate_method, protected_after_filing_year
--   federal_form_change_events.applied_at, rejected_at, rejected_reason,
--                              applied_by, user_overrides_jsonb
--
-- All additive — no destructive changes to existing tables.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Enums ──────────────────────────────────────────────────────────────

CREATE TYPE "public"."client_tag_kind" AS ENUM(
  'penalty_relief',
  'amnesty_program',
  'audit_window',
  'engagement_note'
);
--> statement-breakpoint

CREATE TYPE "public"."client_tag_status" AS ENUM(
  'active',     -- written, not yet applied
  'applied',    -- claimed at filing time
  'expired',    -- expiry passed without application
  'removed'     -- manually untagged
);
--> statement-breakpoint

CREATE TYPE "public"."planning_call_topic" AS ENUM(
  'pte_strategy',
  'rate_change_review',
  'nexus_review',
  'general_planning'
);
--> statement-breakpoint

CREATE TYPE "public"."planning_call_status" AS ENUM(
  'proposed',     -- on Today queue, not yet scheduled
  'scheduled',    -- date/time set
  'completed',    -- happened, outcome recorded
  'missed',       -- deadline passed without scheduling
  'canceled'
);
--> statement-breakpoint

CREATE TYPE "public"."planning_call_outcome" AS ENUM(
  'renewed',      -- pte: kept the election
  'revoked',      -- pte: dropped the election
  'opted_in',     -- pte: started the election
  'deferred',     -- decision punted to next year
  'no_change'
);
--> statement-breakpoint

CREATE TYPE "public"."nexus_kind" AS ENUM(
  'sales',
  'income',
  'payroll',
  'franchise'
);
--> statement-breakpoint

CREATE TYPE "public"."nexus_status" AS ENUM(
  'not_established',
  'check_pending',     -- questionnaire started, not finished
  'established',       -- nexus confirmed, filings active
  'borderline',        -- check inconclusive, flag for next cycle
  'confirmed_no_nexus' -- check returned no
);
--> statement-breakpoint

CREATE TYPE "public"."estimate_method" AS ENUM(
  'safe_harbor_110',
  'safe_harbor_100',
  'current_year_estimate',
  'prior_year_actual',
  'manual'
);
--> statement-breakpoint

-- ─── client_tags (penalty_relief) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE cascade,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
  -- Optional FK — many tags reference an alert, but engagement notes etc may not.
  "alert_id" uuid REFERENCES "announcements"("id") ON DELETE set null,
  "kind" "client_tag_kind" NOT NULL DEFAULT 'penalty_relief',
  -- Pre-rendered label that appears on Workspace tab + TaskDetail banners.
  "tag_text" text NOT NULL,
  -- Free-form context — full notice ref, reasoning, link to source.
  "tag_context" text,
  -- Null = retroactive (no expiry); set = auto-EXPIRE on this date.
  "expires_at" timestamp with time zone,
  "applied_at" timestamp with time zone,
  -- When applied via TaskDetail's "claim relief" button, this links to the
  -- task we applied the relief on. Useful for audit + reporting.
  "applied_in_task_id" uuid REFERENCES "tasks"("id") ON DELETE set null,
  "removed_at" timestamp with time zone,
  "removed_reason" text,
  "status" "client_tag_status" NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_tags_client_active_idx"
  ON "client_tags" ("client_id", "status")
  WHERE "status" = 'active';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_tags_expiry_idx"
  ON "client_tags" ("expires_at")
  WHERE "status" = 'active' AND "expires_at" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_tags_alert_idx"
  ON "client_tags" ("alert_id")
  WHERE "alert_id" IS NOT NULL;
--> statement-breakpoint

-- ─── planning_calls (pte_change) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "planning_calls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE cascade,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
  "alert_id" uuid REFERENCES "announcements"("id") ON DELETE set null,
  "topic" "planning_call_topic" NOT NULL,
  -- Mode E generated bullets shown on the verdict expansion + the eventual
  -- TodoItem on Today. Stored as jsonb to preserve order + allow per-bullet
  -- editing later without schema change.
  "talking_points_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "suggested_window_start" date,
  "suggested_window_end" date,
  -- Set when CPA picks a time. For now string ("Mar 14 10am"); future
  -- calendar integration will add a real timestamptz scheduled_at.
  "scheduled_label" text,
  "scheduled_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "outcome" "planning_call_outcome",
  "outcome_notes" text,
  "status" "planning_call_status" NOT NULL DEFAULT 'proposed',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "planning_calls_client_status_idx"
  ON "planning_calls" ("client_id", "status");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "planning_calls_proposed_idx"
  ON "planning_calls" ("created_at" DESC)
  WHERE "status" = 'proposed';
--> statement-breakpoint

-- ─── client_state_nexus (nexus_change) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS "client_state_nexus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE cascade,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
  "state" text NOT NULL,                 -- StateCode, e.g. "PA"
  "nexus_kind" "nexus_kind" NOT NULL,
  "status" "nexus_status" NOT NULL DEFAULT 'not_established',
  -- Set when status transitions to 'established' from a nexus check.
  "established_at" timestamp with time zone,
  "established_by_alert_id" uuid REFERENCES "announcements"("id") ON DELETE set null,
  "established_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  -- For contraction case — when nexus is no longer required but the firm
  -- chose to keep the filing as protective.
  "kept_protective" boolean NOT NULL DEFAULT false,
  "kept_protective_reason" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One row per (client, state, nexus_kind) — same client can have separate
-- sales/income/payroll nexus rows for the same state.
CREATE UNIQUE INDEX IF NOT EXISTS "client_state_nexus_uniq"
  ON "client_state_nexus" ("client_id", "state", "nexus_kind");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_state_nexus_state_status_idx"
  ON "client_state_nexus" ("state", "status");
--> statement-breakpoint

-- ─── nexus_questionnaire_runs ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "nexus_questionnaire_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE cascade,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
  "alert_id" uuid REFERENCES "announcements"("id") ON DELETE set null,
  "state" text NOT NULL,
  "nexus_kind" "nexus_kind" NOT NULL,
  -- Snapshot of the question set + answers. Immutable once written so we
  -- can audit "what did Sarah see / what did Sarah answer."
  "questions_jsonb" jsonb NOT NULL,
  "answers_jsonb" jsonb NOT NULL,
  "result_status" "nexus_status" NOT NULL,
  "confidence" text NOT NULL DEFAULT 'medium',
  "recommended_filings_jsonb" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_by" uuid REFERENCES "users"("id") ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "nexus_questionnaire_runs_client_state_idx"
  ON "nexus_questionnaire_runs" ("client_id", "state", "nexus_kind");
--> statement-breakpoint

-- ─── Column additions to existing tables ───────────────────────────────

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "pte_election_year" integer,
  ADD COLUMN IF NOT EXISTS "pte_eligibility_status" text,
  -- Per-state estimated revenue (jsonb: { "CA": 250000, "NY": 80000 }).
  -- Sourced from QBO sync if connected, manual entry otherwise.
  ADD COLUMN IF NOT EXISTS "estimated_state_revenue_jsonb" jsonb DEFAULT '{}'::jsonb,
  -- Per-state employee count (jsonb similar shape).
  ADD COLUMN IF NOT EXISTS "employee_count_by_state_jsonb" jsonb DEFAULT '{}'::jsonb,
  -- Whether the client uses a marketplace facilitator that may collect on their behalf.
  ADD COLUMN IF NOT EXISTS "has_marketplace_facilitator" boolean NOT NULL DEFAULT false,
  -- Auto-pay flag: when true, recomputing estimates auto-creates a
  -- "update bank instruction" TodoItem.
  ADD COLUMN IF NOT EXISTS "estimate_autopay" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE "deadlines"
  -- Estimate amount in cents (avoid float). Nullable — non-estimate
  -- filings (annual returns) don't carry an amount.
  ADD COLUMN IF NOT EXISTS "amount_cents" bigint,
  -- Original amount before any rate_change recompute. Populated by
  -- recomputeEstimates so undo can restore.
  ADD COLUMN IF NOT EXISTS "original_amount_cents" bigint,
  ADD COLUMN IF NOT EXISTS "estimate_method" "estimate_method",
  -- For nexus contraction cases: deadline marked kept-as-protective
  -- through this filing year, then auto-disables.
  ADD COLUMN IF NOT EXISTS "protected_after_filing_year" integer;
--> statement-breakpoint

-- ─── form_change admin reviewer queue support ──────────────────────────

ALTER TABLE "federal_form_change_events"
  ADD COLUMN IF NOT EXISTS "applied_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "rejected_reason" text,
  ADD COLUMN IF NOT EXISTS "applied_by" uuid REFERENCES "users"("id") ON DELETE set null,
  -- Admin's modifications to the parsed values before applying.
  -- e.g., AI parsed wrong notes — admin edits, jsonb captures the override.
  ADD COLUMN IF NOT EXISTS "user_overrides_jsonb" jsonb;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fce_pending_review_idx"
  ON "federal_form_change_events" ("created_at" DESC)
  WHERE "applied_at" IS NULL AND "rejected_at" IS NULL;
--> statement-breakpoint
