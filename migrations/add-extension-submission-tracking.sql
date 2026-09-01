ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS submission_url TEXT;

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS live_url TEXT;

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

ALTER TABLE backlinks
  ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_backlinks_last_checked_at
  ON backlinks (last_checked_at);

CREATE TABLE IF NOT EXISTS extension_generated_content (
  id                BIGSERIAL PRIMARY KEY,
  website_id        BIGINT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  resource_id       BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  request_hash      TEXT NOT NULL,
  language          TEXT NOT NULL DEFAULT 'auto',
  model             TEXT NOT NULL,
  content           JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (website_id, resource_id, request_hash)
);

CREATE INDEX IF NOT EXISTS idx_extension_generated_content_pair
  ON extension_generated_content (website_id, resource_id);
