-- ════════════════════════════════════════════════════════════════════════
-- federal_forms.required_items — per-form checklist items (W-2, 1099-INT,
-- K-1, etc.) with optional IRS PDF source link + per-item confidence.
--
-- Drives:
--   - FilingsTab expandable rows: each form lists what the client must
--     provide; IRS PDF deep-link per item.
--   - Mode A inbound classifier: when a doc arrives, the matched form
--     points to the canonical itemType set we expect to fill.
--   - LLM extractor (lib/federal-form-extractor.ts) writes this column
--     when extracting long-tail forms.
--
-- Shape (jsonb array):
--   [
--     { "label": "All W-2s (wage statements)",
--       "itemType": "wage_w2",
--       "source": "https://www.irs.gov/pub/irs-pdf/p17.pdf",
--       "confidence": 0.95 }
--   ]
--
-- confidence is per-item, separate from federal_forms.confidence_score
-- (which is for the form's metadata as a whole).
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE federal_forms
  ADD COLUMN IF NOT EXISTS required_items jsonb NOT NULL DEFAULT '[]'::jsonb;
