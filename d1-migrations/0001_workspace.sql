CREATE TABLE IF NOT EXISTS websites (id           INTEGER PRIMARY KEY,
  domain       TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT,
  created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active    INTEGER DEFAULT 1,
CONSTRAINT websites_domain_unique UNIQUE (domain)
);

CREATE TABLE IF NOT EXISTS resources (id               INTEGER PRIMARY KEY,
  domain           TEXT NOT NULL,
  url              TEXT,
  contact_email    TEXT,
  domain_authority INTEGER DEFAULT 0,
  category         TEXT,
  cost             REAL DEFAULT 0,
  notes            TEXT,
  created_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS backlinks (id             INTEGER PRIMARY KEY,
  website_id     INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  resource_id    INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'pending',
  anchor_text    TEXT,
  target_url     TEXT,
  placement_date TEXT,
  removal_date   TEXT,
  cost           REAL DEFAULT 0,
  notes          TEXT,
  created_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  submitted_at TEXT,
  submission_url TEXT,
  live_url TEXT,
  last_checked_at TEXT,
  status_history TEXT NOT NULL DEFAULT '[]',
CONSTRAINT backlinks_website_resource_unique UNIQUE (website_id, resource_id)
);

CREATE TABLE IF NOT EXISTS website_extended_info (id            INTEGER PRIMARY KEY,
  website_id    INTEGER NOT NULL UNIQUE REFERENCES websites(id) ON DELETE CASCADE,
  support_email TEXT,
  title         TEXT,
  description   TEXT,
  url           TEXT,
  created_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  short_description TEXT
);

CREATE TABLE IF NOT EXISTS backlink_operation_runs (id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS backlink_operation_attempts (id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES backlink_operation_runs(id),
  website_id INTEGER NOT NULL REFERENCES websites(id),
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  status TEXT NOT NULL CHECK (status IN ('reserved','submitted','failed','uncertain')),
  evidence_url TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS backlink_operation_checks (id INTEGER PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id),
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  result TEXT NOT NULL CHECK (result IN ('listed','pending','missing_link','unreachable','removed')),
  evidence_url TEXT,
  target_url TEXT,
  rel TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS backlink_operation_resource_reviews (id INTEGER PRIMARY KEY,
  domain TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('free','exchange','unavailable','pending')),
  entry_url TEXT,
  note TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS backlink_operation_reports (id INTEGER PRIMARY KEY,
  run_id TEXT REFERENCES backlink_operation_runs(id),
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS extension_form_workflows (workflow_id       TEXT PRIMARY KEY,
  resource_id       INTEGER NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  domain            TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT 'Submission workflow',
  status            TEXT NOT NULL DEFAULT 'learning',
  version           INTEGER NOT NULL DEFAULT 1,
  steps             TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS extension_prospect_sources (root_domain       TEXT NOT NULL REFERENCES extension_prospects(root_domain) ON DELETE CASCADE,
  source_domain     TEXT NOT NULL,
  authority         INTEGER,
  first_seen_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (root_domain, source_domain)
);

CREATE TABLE IF NOT EXISTS extension_prospects (root_domain       TEXT PRIMARY KEY,
  authority         INTEGER,
  csv_file_count    INTEGER,
  source_files      TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  submission_url    TEXT,
  notes             TEXT,
  excluded          INTEGER NOT NULL DEFAULT 0,
  excluded_at       TEXT,
  excluded_reason   TEXT,
  last_opened_at    TEXT,
  last_imported_at  TEXT,
  import_order      INTEGER NOT NULL DEFAULT 0,
  queue_position    INTEGER,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  screening_status TEXT NOT NULL DEFAULT 'unscreened',
  screening_category TEXT,
  screening_confidence INTEGER,
  screening_cost TEXT NOT NULL DEFAULT 'unknown',
  screening_entry_url TEXT,
  screening_summary TEXT,
  screening_evidence TEXT NOT NULL DEFAULT '[]',
  screening_ruleset TEXT,
  screened_at TEXT,
  source_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS extension_generated_content (id                INTEGER PRIMARY KEY,
  website_id        INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  resource_id       INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  request_hash      TEXT NOT NULL,
  language          TEXT NOT NULL DEFAULT 'auto',
  model             TEXT NOT NULL,
  content           TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (website_id, resource_id, request_hash)
);

CREATE TABLE IF NOT EXISTS partner_links (id          INTEGER PRIMARY KEY,
  site        TEXT NOT NULL,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  type TEXT NOT NULL DEFAULT 'link',
  image_src TEXT,
  image_width INTEGER,
  image_height INTEGER,
  image_alt TEXT,
  rel TEXT NOT NULL DEFAULT 'noopener'
);

CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites (domain);

CREATE INDEX IF NOT EXISTS idx_websites_active ON websites (is_active);

CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources (domain);

CREATE INDEX IF NOT EXISTS idx_resources_active ON resources (is_active);

CREATE INDEX IF NOT EXISTS idx_resources_da ON resources (domain_authority);

CREATE INDEX IF NOT EXISTS idx_backlinks_website ON backlinks (website_id);

CREATE INDEX IF NOT EXISTS idx_backlinks_resource ON backlinks (resource_id);

CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks (status);

CREATE INDEX IF NOT EXISTS idx_backlinks_website_status ON backlinks (website_id, status);

CREATE INDEX IF NOT EXISTS idx_website_extended_info_website_id ON website_extended_info (website_id);

CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites (domain);

CREATE INDEX IF NOT EXISTS idx_websites_active ON websites (is_active);

CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources (domain);

CREATE INDEX IF NOT EXISTS idx_resources_active ON resources (is_active);

CREATE INDEX IF NOT EXISTS idx_resources_da ON resources (domain_authority);

CREATE INDEX IF NOT EXISTS idx_backlinks_website ON backlinks (website_id);

CREATE INDEX IF NOT EXISTS idx_backlinks_resource ON backlinks (resource_id);

CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks (status);

CREATE INDEX IF NOT EXISTS idx_backlinks_website_status ON backlinks (website_id, status);

CREATE INDEX IF NOT EXISTS idx_website_extended_info_website_id ON website_extended_info (website_id);

CREATE UNIQUE INDEX IF NOT EXISTS backlink_operation_open_day ON backlink_operation_runs(day) WHERE status = 'open';

CREATE UNIQUE INDEX IF NOT EXISTS backlink_operation_pair_guard ON backlink_operation_attempts(website_id,resource_id) WHERE status IN ('reserved','submitted','uncertain');

CREATE INDEX IF NOT EXISTS backlink_operation_reports_day ON backlink_operation_reports(day,created_at);

CREATE INDEX IF NOT EXISTS backlink_operation_checks_pair ON backlink_operation_checks(website_id,resource_id,checked_at DESC);

CREATE INDEX IF NOT EXISTS backlink_operation_resource_reviews_domain ON backlink_operation_resource_reviews(domain,checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_extension_form_workflows_resource
  ON extension_form_workflows (resource_id);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_status
  ON extension_prospects (screening_status);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_screening_category
  ON extension_prospects (screening_category);

CREATE INDEX IF NOT EXISTS idx_extension_prospect_sources_source
  ON extension_prospect_sources (source_domain);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_status
  ON extension_prospects (status);

CREATE INDEX IF NOT EXISTS idx_extension_prospects_queue
  ON extension_prospects (queue_position);

CREATE INDEX IF NOT EXISTS idx_backlinks_last_checked_at
  ON backlinks (last_checked_at);

CREATE INDEX IF NOT EXISTS idx_extension_generated_content_pair
  ON extension_generated_content (website_id, resource_id);

CREATE INDEX IF NOT EXISTS idx_partner_links_site ON partner_links (site);

CREATE INDEX IF NOT EXISTS idx_partner_links_active ON partner_links (is_active);

CREATE TABLE workspace_revision(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL DEFAULT 0);
INSERT INTO workspace_revision(id,revision) VALUES(1,0);
CREATE TABLE workspace_guard(expected INTEGER NOT NULL);
CREATE TRIGGER workspace_guard_check BEFORE INSERT ON workspace_guard
WHEN NEW.expected != (SELECT revision FROM workspace_revision WHERE id=1)
BEGIN SELECT RAISE(ABORT, 'WORKSPACE_CONFLICT'); END;

CREATE TRIGGER revision_websites_insert AFTER INSERT ON websites BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_websites_update AFTER UPDATE ON websites BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_websites_delete AFTER DELETE ON websites BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_resources_insert AFTER INSERT ON resources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_resources_update AFTER UPDATE ON resources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_resources_delete AFTER DELETE ON resources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlinks_insert AFTER INSERT ON backlinks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlinks_update AFTER UPDATE ON backlinks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlinks_delete AFTER DELETE ON backlinks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_website_extended_info_insert AFTER INSERT ON website_extended_info BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_website_extended_info_update AFTER UPDATE ON website_extended_info BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_website_extended_info_delete AFTER DELETE ON website_extended_info BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_runs_insert AFTER INSERT ON backlink_operation_runs BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_runs_update AFTER UPDATE ON backlink_operation_runs BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_runs_delete AFTER DELETE ON backlink_operation_runs BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_attempts_insert AFTER INSERT ON backlink_operation_attempts BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_attempts_update AFTER UPDATE ON backlink_operation_attempts BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_attempts_delete AFTER DELETE ON backlink_operation_attempts BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_checks_insert AFTER INSERT ON backlink_operation_checks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_checks_update AFTER UPDATE ON backlink_operation_checks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_checks_delete AFTER DELETE ON backlink_operation_checks BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_resource_reviews_insert AFTER INSERT ON backlink_operation_resource_reviews BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_resource_reviews_update AFTER UPDATE ON backlink_operation_resource_reviews BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_resource_reviews_delete AFTER DELETE ON backlink_operation_resource_reviews BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_reports_insert AFTER INSERT ON backlink_operation_reports BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_reports_update AFTER UPDATE ON backlink_operation_reports BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_backlink_operation_reports_delete AFTER DELETE ON backlink_operation_reports BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_form_workflows_insert AFTER INSERT ON extension_form_workflows BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_form_workflows_update AFTER UPDATE ON extension_form_workflows BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_form_workflows_delete AFTER DELETE ON extension_form_workflows BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospect_sources_insert AFTER INSERT ON extension_prospect_sources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospect_sources_update AFTER UPDATE ON extension_prospect_sources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospect_sources_delete AFTER DELETE ON extension_prospect_sources BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospects_insert AFTER INSERT ON extension_prospects BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospects_update AFTER UPDATE ON extension_prospects BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_prospects_delete AFTER DELETE ON extension_prospects BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_generated_content_insert AFTER INSERT ON extension_generated_content BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_generated_content_update AFTER UPDATE ON extension_generated_content BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_extension_generated_content_delete AFTER DELETE ON extension_generated_content BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_partner_links_insert AFTER INSERT ON partner_links BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_partner_links_update AFTER UPDATE ON partner_links BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER revision_partner_links_delete AFTER DELETE ON partner_links BEGIN UPDATE workspace_revision SET revision=revision+1 WHERE id=1; END;

CREATE TRIGGER auto_websites_backlinks AFTER INSERT ON websites WHEN NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM workspace_guard) BEGIN INSERT INTO backlinks(website_id,resource_id,status) SELECT NEW.id,id,'pending' FROM resources WHERE is_active=1 ON CONFLICT(website_id,resource_id) DO NOTHING; END;

CREATE TRIGGER auto_resources_backlinks AFTER INSERT ON resources WHEN NEW.is_active=1 AND NOT EXISTS(SELECT 1 FROM workspace_guard) BEGIN INSERT INTO backlinks(website_id,resource_id,status) SELECT id,NEW.id,'pending' FROM websites WHERE is_active=1 ON CONFLICT(website_id,resource_id) DO NOTHING; END;

CREATE TABLE backlink_report_parts (
 report_id INTEGER NOT NULL REFERENCES backlink_operation_reports(id) ON DELETE CASCADE,
 part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(report_id,part)
);
