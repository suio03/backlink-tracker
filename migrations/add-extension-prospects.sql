-- Discovery and review queue used by the Backlink Desk Chrome extension.
-- Existing websites, resources, backlinks, website info, and partner links are untouched.

CREATE TABLE IF NOT EXISTS extension_prospects (
  root_domain       TEXT PRIMARY KEY,
  authority         INTEGER,
  csv_file_count    INTEGER,
  source_files      TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  submission_url    TEXT,
  notes             TEXT,
  excluded          BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_at       TIMESTAMPTZ,
  excluded_reason   TEXT,
  last_opened_at    TIMESTAMPTZ,
  last_imported_at  TIMESTAMPTZ,
  import_order      INTEGER NOT NULL DEFAULT 0,
  queue_position    INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_status
  ON extension_prospects (status);
CREATE INDEX IF NOT EXISTS idx_extension_prospects_queue
  ON extension_prospects (queue_position);
