-- PostgreSQL Seed Data for Backlink Tracker
-- Mounted into /docker-entrypoint-initdb.d/02-seed.sql

BEGIN;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM websites) = 0 THEN
    INSERT INTO websites (domain, name, category, is_active)
    VALUES ('example.com', 'Example', 'other', TRUE);
  END IF;

  IF (SELECT COUNT(*) FROM resources) = 0 THEN
    INSERT INTO resources (domain, url, contact_email, domain_authority, category, cost, notes, is_active)
    VALUES ('directory.example', 'https://directory.example/submit', NULL, 0, 'project-directory', 0, 'Seed example resource', TRUE);
  END IF;
END $$;

COMMIT;

-- PostgreSQL Seed Data for Backlink Tracker
-- This file is mounted into /docker-entrypoint-initdb.d/02-seed.sql
-- and executed automatically by the official postgres image on first init.

BEGIN;

-- Keep seed idempotent: only seed when tables are empty.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM websites) = 0 THEN
    INSERT INTO websites (domain, name, category, is_active)
    VALUES
      ('example.com', 'Example', 'other', TRUE);
  END IF;

  IF (SELECT COUNT(*) FROM resources) = 0 THEN
    INSERT INTO resources (domain, url, contact_email, domain_authority, category, cost, notes, is_active)
    VALUES
      ('directory.example', 'https://directory.example/submit', NULL, 0, 'project-directory', 0, 'Seed example resource', TRUE);
  END IF;
END $$;

COMMIT;

