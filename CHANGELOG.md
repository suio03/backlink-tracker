# Changelog

## [0.2.0] - 2026-08-18
### Added
- Bearer-token authentication for partner-link create and delete operations while keeping the Worker-facing list endpoint public.

## [0.1.1] - 2026-03-31
### Fixed
- SSL configuration in production now respects `sslmode=disable` in the DATABASE_URL, fixing connection failures when deploying with a non-SSL PostgreSQL container (e.g. Dokploy + Docker Compose)
