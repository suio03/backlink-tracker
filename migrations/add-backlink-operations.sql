BEGIN;
-- Additive operations ledger. Existing prospects, reviews and submissions remain intact.
CREATE TABLE IF NOT EXISTS backlink_operation_runs (
  id UUID PRIMARY KEY,
  day DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS backlink_operation_open_day ON backlink_operation_runs(day) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS backlink_operation_attempts (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES backlink_operation_runs(id),
  website_id BIGINT NOT NULL REFERENCES websites(id),
  resource_id BIGINT NOT NULL REFERENCES resources(id),
  status TEXT NOT NULL CHECK (status IN ('reserved','submitted','failed','uncertain')),
  evidence_url TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS backlink_operation_pair_guard ON backlink_operation_attempts(website_id,resource_id) WHERE status IN ('reserved','submitted','uncertain');
CREATE TABLE IF NOT EXISTS backlink_operation_checks (
  id BIGSERIAL PRIMARY KEY,
  website_id BIGINT NOT NULL REFERENCES websites(id),
  resource_id BIGINT NOT NULL REFERENCES resources(id),
  result TEXT NOT NULL CHECK (result IN ('listed','pending','missing_link','unreachable','removed')),
  evidence_url TEXT,
  target_url TEXT,
  rel TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS backlink_operation_resource_reviews (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('free','exchange','unavailable','pending')),
  entry_url TEXT,
  note TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS backlink_operation_reports (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES backlink_operation_runs(id),
  day DATE NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS backlink_operation_reports_day ON backlink_operation_reports(day,created_at);
CREATE INDEX IF NOT EXISTS backlink_operation_checks_pair ON backlink_operation_checks(website_id,resource_id,checked_at DESC);
CREATE INDEX IF NOT EXISTS backlink_operation_resource_reviews_domain ON backlink_operation_resource_reviews(domain,checked_at DESC);
COMMIT;
