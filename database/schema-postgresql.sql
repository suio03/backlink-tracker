-- PostgreSQL Schema for Backlink Tracker
-- Mounted into /docker-entrypoint-initdb.d/01-schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS websites (
  id           BIGSERIAL PRIMARY KEY,
  domain       TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT websites_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites (domain);
CREATE INDEX IF NOT EXISTS idx_websites_active ON websites (is_active);

DROP TRIGGER IF EXISTS trg_websites_set_updated_at ON websites;
CREATE TRIGGER trg_websites_set_updated_at
BEFORE UPDATE ON websites
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS resources (
  id               BIGSERIAL PRIMARY KEY,
  domain           TEXT NOT NULL,
  url              TEXT NOT NULL,
  contact_email    TEXT,
  domain_authority INTEGER NOT NULL DEFAULT 0,
  category         TEXT NOT NULL,
  cost             NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT resources_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources (domain);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources (is_active);
CREATE INDEX IF NOT EXISTS idx_resources_da ON resources (domain_authority);
CREATE INDEX IF NOT EXISTS idx_resources_domain_trgm ON resources USING GIN (domain gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_resources_set_updated_at ON resources;
CREATE TRIGGER trg_resources_set_updated_at
BEFORE UPDATE ON resources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backlink_status') THEN
    CREATE TYPE backlink_status AS ENUM ('pending', 'requested', 'placed', 'live', 'removed', 'rejected');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS backlinks (
  id             BIGSERIAL PRIMARY KEY,
  website_id     BIGINT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  resource_id    BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status         backlink_status NOT NULL DEFAULT 'pending',
  anchor_text    TEXT,
  target_url     TEXT,
  placement_date DATE,
  removal_date   DATE,
  cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT backlinks_website_resource_unique UNIQUE (website_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_backlinks_website ON backlinks (website_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_resource ON backlinks (resource_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks (status);
CREATE INDEX IF NOT EXISTS idx_backlinks_website_status ON backlinks (website_id, status);

DROP TRIGGER IF EXISTS trg_backlinks_set_updated_at ON backlinks;
CREATE TRIGGER trg_backlinks_set_updated_at
BEFORE UPDATE ON backlinks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS website_extended_info (
  id            BIGSERIAL PRIMARY KEY,
  website_id    BIGINT NOT NULL UNIQUE REFERENCES websites(id) ON DELETE CASCADE,
  support_email TEXT,
  title         TEXT,
  description   TEXT,
  url           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_website_extended_info_website_id ON website_extended_info (website_id);

DROP TRIGGER IF EXISTS trg_website_extended_info_set_updated_at ON website_extended_info;
CREATE TRIGGER trg_website_extended_info_set_updated_at
BEFORE UPDATE ON website_extended_info
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION auto_add_resource_to_websites()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT w.id, NEW.id, 'pending'
    FROM websites w
    WHERE w.is_active
    ON CONFLICT (website_id, resource_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_add_resource_to_websites ON resources;
CREATE TRIGGER trg_auto_add_resource_to_websites
AFTER INSERT ON resources
FOR EACH ROW EXECUTE FUNCTION auto_add_resource_to_websites();

CREATE OR REPLACE FUNCTION auto_add_resources_to_website()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT NEW.id, r.id, 'pending'
    FROM resources r
    WHERE r.is_active
    ON CONFLICT (website_id, resource_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_add_resources_to_website ON websites;
CREATE TRIGGER trg_auto_add_resources_to_website
AFTER INSERT ON websites
FOR EACH ROW EXECUTE FUNCTION auto_add_resources_to_website();

COMMIT;

-- PostgreSQL Schema for Backlink Tracker
-- This file is mounted into /docker-entrypoint-initdb.d/01-schema.sql
-- and executed automatically by the official postgres image on first init.

BEGIN;

-- =============================================
-- Extensions (safe to run repeatedly)
-- =============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- Helper: updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Table: websites
-- Stores all user's websites that need backlinks
-- =============================================
CREATE TABLE IF NOT EXISTS websites (
  id           BIGSERIAL PRIMARY KEY,
  domain       TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT websites_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_websites_domain ON websites (domain);
CREATE INDEX IF NOT EXISTS idx_websites_active ON websites (is_active);

DROP TRIGGER IF EXISTS trg_websites_set_updated_at ON websites;
CREATE TRIGGER trg_websites_set_updated_at
BEFORE UPDATE ON websites
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Table: resources
-- Stores all backlink opportunities/resources
-- =============================================
CREATE TABLE IF NOT EXISTS resources (
  id              BIGSERIAL PRIMARY KEY,
  domain          TEXT NOT NULL,
  url             TEXT NOT NULL,
  contact_email   TEXT,
  domain_authority INTEGER NOT NULL DEFAULT 0,
  category        TEXT NOT NULL,
  cost            NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT resources_domain_unique UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_resources_domain ON resources (domain);
CREATE INDEX IF NOT EXISTS idx_resources_active ON resources (is_active);
CREATE INDEX IF NOT EXISTS idx_resources_da ON resources (domain_authority);
CREATE INDEX IF NOT EXISTS idx_resources_domain_trgm ON resources USING GIN (domain gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_resources_set_updated_at ON resources;
CREATE TRIGGER trg_resources_set_updated_at
BEFORE UPDATE ON resources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Table: backlinks
-- Junction table tracking website-resource relationships
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backlink_status') THEN
    CREATE TYPE backlink_status AS ENUM ('pending', 'requested', 'placed', 'live', 'removed', 'rejected');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS backlinks (
  id            BIGSERIAL PRIMARY KEY,
  website_id    BIGINT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  resource_id   BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status        backlink_status NOT NULL DEFAULT 'pending',
  anchor_text   TEXT,
  target_url    TEXT,
  placement_date DATE,
  removal_date  DATE,
  cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT backlinks_website_resource_unique UNIQUE (website_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_backlinks_website ON backlinks (website_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_resource ON backlinks (resource_id);
CREATE INDEX IF NOT EXISTS idx_backlinks_status ON backlinks (status);
CREATE INDEX IF NOT EXISTS idx_backlinks_website_status ON backlinks (website_id, status);

DROP TRIGGER IF EXISTS trg_backlinks_set_updated_at ON backlinks;
CREATE TRIGGER trg_backlinks_set_updated_at
BEFORE UPDATE ON backlinks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Table: website_extended_info
-- Stores extra scraped info for a website (optional)
-- =============================================
CREATE TABLE IF NOT EXISTS website_extended_info (
  id          BIGSERIAL PRIMARY KEY,
  website_id  BIGINT NOT NULL UNIQUE REFERENCES websites(id) ON DELETE CASCADE,
  support_email TEXT,
  title       TEXT,
  description TEXT,
  url         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_website_extended_info_website_id ON website_extended_info (website_id);

DROP TRIGGER IF EXISTS trg_website_extended_info_set_updated_at ON website_extended_info;
CREATE TRIGGER trg_website_extended_info_set_updated_at
BEFORE UPDATE ON website_extended_info
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Auto-linking triggers
-- New resource => backlinks for all active websites
-- New website => backlinks for all active resources
-- =============================================
CREATE OR REPLACE FUNCTION auto_add_resource_to_websites()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT w.id, NEW.id, 'pending'
    FROM websites w
    WHERE w.is_active
    ON CONFLICT (website_id, resource_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_add_resource_to_websites ON resources;
CREATE TRIGGER trg_auto_add_resource_to_websites
AFTER INSERT ON resources
FOR EACH ROW
EXECUTE FUNCTION auto_add_resource_to_websites();

CREATE OR REPLACE FUNCTION auto_add_resources_to_website()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active THEN
    INSERT INTO backlinks (website_id, resource_id, status)
    SELECT NEW.id, r.id, 'pending'
    FROM resources r
    WHERE r.is_active
    ON CONFLICT (website_id, resource_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_add_resources_to_website ON websites;
CREATE TRIGGER trg_auto_add_resources_to_website
AFTER INSERT ON websites
FOR EACH ROW
EXECUTE FUNCTION auto_add_resources_to_website();

COMMIT;

