-- Add service_start_date to clients — when the firm took on this client.
-- Deadline-generator skips rows with official_due_date < service_start_date
-- so newly-imported clients don't show "8d late" for deadlines that pre-date
-- their service window. NULL = treat as "from beginning of time" (existing
-- behavior preserved for old clients).
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_start_date date;

-- Backfill: existing clients get service_start_date = created_at::date.
-- This applies the new filter retroactively without breaking past data
-- (deadlines for periods before each client's onboarding stop generating
-- on the next deadline-generator run).
UPDATE clients
SET service_start_date = created_at::date
WHERE service_start_date IS NULL;
