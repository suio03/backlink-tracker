# Changelog

## [0.7.0] - 2026-09-02
### Added
- Persistent submission timestamps, submission and live URLs, last-check metadata, and bounded status history for every website-resource relationship.
- A Bearer-protected `/api/extension/content` endpoint using structured OpenAI output and per-target database caching.
- An idempotent migration for submission tracking and generated-content storage.

### Changed
- Extension workspace reads and writes now round-trip the complete submission tracking record.
- Target-specific copy defaults to `gpt-5-nano` and can be changed with `OPENAI_CONTENT_MODEL`; the API key remains backend-only.

### Fixed
- Submission history payloads are normalized and size-limited before PostgreSQL writes.

## [0.6.0] - 2026-09-01
### Added
- Dedicated PostgreSQL screening columns and indexes for extension prospects.
- A Bearer-protected screening-only batch endpoint that updates existing prospect screening metadata without inserting, deleting, or changing manual fields.

### Changed
- Extension workspace reads now include normalized screening status, category, confidence, cost, entry URL, evidence, ruleset, and timestamp fields.

### Fixed
- Screening payloads now validate categories, costs, confidence, public HTTP(S) URLs, evidence size, and timestamps before database writes.

## [0.5.0] - 2026-09-01
### Added
- Source-aware Semrush prospect imports with per-domain source counts and last-seen timestamps.
- Transactional batch ingestion that normalizes domains and preserves the highest authority score.

### Changed
- The authenticated extension workspace endpoint now accepts direct Semrush report synchronization without intermediate CSV downloads.

### Fixed
- Reprocessing the same source website no longer inflates a prospect's occurrence count.

## [0.4.0] - 2026-08-20
### Added
- Database-backed multi-step form workflow templates for the Backlink Desk extension.

### Changed
- The extension workspace API now loads and patches learned workflows together with websites, resources, and submissions.

### Fixed
- Removing a backlink resource also removes only its learned form workflow through a scoped database cascade.

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
