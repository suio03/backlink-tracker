-- Reusable multi-step form workflows learned by the Backlink Desk extension.
-- Deleting a resource deletes only its associated workflow. Partner links are untouched.

CREATE TABLE IF NOT EXISTS extension_form_workflows (
  workflow_id       TEXT PRIMARY KEY,
  resource_id       BIGINT NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  domain            TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT 'Submission workflow',
  status            TEXT NOT NULL DEFAULT 'learning',
  version           INTEGER NOT NULL DEFAULT 1,
  steps             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_form_workflows_resource
  ON extension_form_workflows (resource_id);
