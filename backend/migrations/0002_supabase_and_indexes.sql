-- Hand-written follow-up to 0000_initial.sql.
-- Drizzle-kit can't see Supabase's auth.* schema, so we add the FK to
-- auth.users(id) here. Also adds the perf indexes from arch v0.7 §5.11
-- that Drizzle didn't emit because they weren't declared in schema.ts.

-- Link our public.users.id to Supabase Auth so account deletions cascade.
DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_id_auth_users_id_fk"
    FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN
    -- auth schema absent (e.g. running against a non-Supabase Postgres for local tests).
    -- Skip silently; the FK is a Supabase-only safety net.
    NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "users_firm_id_idx" ON "users"("firm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_firm_id_status_idx" ON "clients"("firm_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_firm_id_assigned_user_idx" ON "clients"("firm_id","assigned_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_packages_firm_id_idx" ON "service_packages"("firm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadlines_firm_id_status_idx" ON "deadlines"("firm_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadlines_firm_id_due_date_idx" ON "deadlines"("firm_id","adjusted_due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deadlines_client_id_idx" ON "deadlines"("client_id");
