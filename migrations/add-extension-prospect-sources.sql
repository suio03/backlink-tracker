-- Source-aware Semrush imports for the Backlink Desk Chrome extension.
-- A domain is counted once per distinct source website, even when re-imported.

ALTER TABLE extension_prospects
  ADD COLUMN IF NOT EXISTS source_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extension_prospects
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS extension_prospect_sources (
  root_domain       TEXT NOT NULL REFERENCES extension_prospects(root_domain) ON DELETE CASCADE,
  source_domain     TEXT NOT NULL,
  authority         INTEGER,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (root_domain, source_domain)
);

CREATE INDEX IF NOT EXISTS idx_extension_prospect_sources_source
  ON extension_prospect_sources (source_domain);
