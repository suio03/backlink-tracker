# Changelog

## [0.3.0] - 2026-08-20
### Added
- A token-protected extension workspace API backed by the existing PostgreSQL websites, resources, backlinks, and website information.
- Persistent discovery prospects plus transactional batch create, edit, and delete support for the Backlink Desk extension.

### Changed
- Production and development containers now receive the extension API token from their deployment environment.

### Fixed
- Extension edits and deletions now update only the selected database records without touching partner links.

## [0.2.0] - 2026-08-18
### Added
- Bearer-token authentication for partner-link create and delete operations while keeping the Worker-facing list endpoint public.

## [0.1.1] - 2026-03-31
### Fixed
- SSL configuration in production now respects `sslmode=disable` in the DATABASE_URL, fixing connection failures when deploying with a non-SSL PostgreSQL container (e.g. Dokploy + Docker Compose)
