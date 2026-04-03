-- Migration: Add partner_links table
-- Used by Cloudflare Worker to inject backlinks into website footers

CREATE TABLE IF NOT EXISTS partner_links (
  id          BIGSERIAL PRIMARY KEY,
  site        TEXT NOT NULL,              -- which site shows this link (e.g. 'fablepilot.com')
  label       TEXT NOT NULL,              -- anchor text
  url         TEXT NOT NULL,              -- link URL
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_links_site ON partner_links (site);
CREATE INDEX IF NOT EXISTS idx_partner_links_active ON partner_links (is_active);

DROP TRIGGER IF EXISTS trg_partner_links_set_updated_at ON partner_links;
CREATE TRIGGER trg_partner_links_set_updated_at
BEFORE UPDATE ON partner_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
