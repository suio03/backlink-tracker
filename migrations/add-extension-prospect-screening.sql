-- Non-destructive automated screening metadata for Backlink Desk prospects.
-- These fields are independent from manual review status, exclusion, notes,
-- and submission URLs.

ALTER TABLE extension_prospects
  ADD COLUMN IF NOT EXISTS screening_status TEXT NOT NULL DEFAULT 'unscreened',
  ADD COLUMN IF NOT EXISTS screening_category TEXT,
  ADD COLUMN IF NOT EXISTS screening_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS screening_cost TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS screening_entry_url TEXT,
  ADD COLUMN IF NOT EXISTS screening_summary TEXT,
  ADD COLUMN IF NOT EXISTS screening_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS screening_ruleset TEXT,
  ADD COLUMN IF NOT EXISTS screened_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_status
  ON extension_prospects (screening_status);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_category
  ON extension_prospects (screening_category);
