-- ════════════════════════════════════════════════════════════════════════
-- Client notes feed — backs the per-client note list on Client Detail
-- (PRD §4.6).
--
-- Distinct from `clients.notes` (legacy single text field). This table
-- is append-only: each note is its own row with author + pinned state +
-- optional deadline link. Mutations:
--
--   clients.addNote        — INSERT
--   clients.toggleNotePin  — UPDATE pinned
--   clients.deleteNote     — DELETE (hard; <24h safety net handled at FE)
--
-- Additive — no changes to existing tables.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "client_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "firm_id" uuid NOT NULL REFERENCES "firms"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "author_user_id" uuid REFERENCES "users"("id"),
  "body" text NOT NULL,
  "pinned" boolean NOT NULL DEFAULT false,
  "related_deadline_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Per-client read pattern: list-by-client ordered by pinned-first then recency.
CREATE INDEX IF NOT EXISTS "client_notes_client_pinned_created_idx"
  ON "client_notes" ("client_id", "pinned" DESC, "created_at" DESC);

-- Firm-scope filter for RLS (added in a later migration if needed).
CREATE INDEX IF NOT EXISTS "client_notes_firm_idx"
  ON "client_notes" ("firm_id");
