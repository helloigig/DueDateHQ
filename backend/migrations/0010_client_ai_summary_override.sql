-- ════════════════════════════════════════════════════════════════════════
-- AI summary override on the client detail header (PRD §4.6 + 2026-05-04
-- dogfooding feedback — replaces the noisy `s_corp · Texas · active ·
-- Added —` meta line with a structured AI-generated behaviour summary).
--
-- Adds:
--   clients.ai_summary_override — nullable text. When set, the FE renders
--                                 this string in place of the
--                                 auto-composed sentence; when null, the
--                                 regenerator owns the line. Cleared by
--                                 saving empty string in the FE editor.
--
-- All additive — no destructive changes.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "ai_summary_override" text;
