-- ════════════════════════════════════════════════════════════════════════
-- Task action surface — backend support for the canonical 8-action set
-- on the Task spine. Companion to the v0.8 lifecycle verbs design.
--
-- Adds:
--   tasks.reviewer_user_id        — Layer-1 reviewer (preparer was already on
--                                   the row as `assigned_user_id`)
--   tasks.not_applicable_reason   — required when status='not_applicable'
--   tasks.not_applicable_at       — set on transition into not_applicable
--   task_status += 'not_applicable' — distinct from 'deferred' (kill, not push)
--   checklist_items.added_by_user_id — null = system/template, set = user-
--                                   added; only the latter is deletable
--   task_notes                    — per-task note feed (mirrors client_notes
--                                   shape; pinned + author + free-form body)
--
-- All additive — no destructive changes.
-- ════════════════════════════════════════════════════════════════════════

-- Postgres requires ALTER TYPE for enum extension. IF NOT EXISTS keeps it
-- idempotent across replays (Drizzle's tracker re-applies on schema sync).
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'not_applicable';
--> statement-breakpoint

ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "reviewer_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "not_applicable_reason" text,
  ADD COLUMN IF NOT EXISTS "not_applicable_at" timestamp with time zone;
--> statement-breakpoint

-- Custom-vs-template provenance. Null = baseline (Mode A from service template
-- or system-seeded); set = user added it post-creation. The application layer
-- only allows deletion of rows where this is set — protects template integrity.
ALTER TABLE "checklist_items"
  ADD COLUMN IF NOT EXISTS "added_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "task_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "pinned" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Per-task read pattern: list-by-task, pinned-first then recency.
CREATE INDEX IF NOT EXISTS "task_notes_task_pinned_created_idx"
  ON "task_notes" ("task_id", "pinned" DESC, "created_at" DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "task_notes_firm_idx"
  ON "task_notes" ("firm_id");
