# Backlink Tracker

Next.js 15 and PostgreSQL application for managing owned websites, backlink
resources, and the submission relationship between every website and resource.
It also provides the authenticated backend used by the Backlink Desk Chrome
extension.

## Runtime architecture

- Next.js App Router with TypeScript and React 19.
- PostgreSQL through `pg`; `DATABASE_URL` is the runtime connection source.
- `websites`, `website_extended_info`, `resources`, and `backlinks` hold the
  primary tracker data.
- Extension-only prospect, source, learned-workflow, and generated-content data
  use separate `extension_*` tables.
- Docker Compose and Dokploy are the supported production deployment path.

The extension workspace must never read, write, migrate, or export
`partner_links`. Partner-link routes remain a separate authenticated feature.

## Backlink Desk extension API

All extension routes use the same personal Bearer token from
`BACKLINK_EXTENSION_TOKEN`:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET/PATCH/POST` | `/api/extension/workspace` | Load/patch the workspace and import Semrush prospects |
| `PATCH` | `/api/extension/screening` | Update screening-only metadata without changing manual decisions |
| `POST` | `/api/extension/content` | Generate cached, target-specific submission copy |

Learned multi-step form templates live in `extension_form_workflows` and are
deleted with their resource. Submission tracking on `backlinks` includes the
submitted time, submission URL, live URL, last-check time, and bounded status
history.

The content endpoint reads public website profile fields and target-resource
metadata from PostgreSQL, then requests structured content from OpenAI. Set
`OPENAI_API_KEY` only in the backend environment. `OPENAI_CONTENT_MODEL` is
optional and defaults to `gpt-5-nano`; generated content is cached by the full
website/resource/model/language/form-field input hash.

## Environment

Copy `env.example` to `.env` for Docker or provide the same values through the
deployment environment:

```dotenv
DATABASE_URL=postgresql://backlink_user:change_this_password@postgres:5432/backlink_tracker?sslmode=disable
BACKLINK_EXTENSION_TOKEN=replace_with_a_long_random_token
OPENAI_API_KEY=replace_with_your_backend_only_openai_key
OPENAI_CONTENT_MODEL=gpt-5-nano
```

Never commit real database credentials, extension tokens, or OpenAI keys.

## Local development

```bash
npm install
npm run dev
```

The application is available at `http://localhost:3000` when run directly.
For the Docker hot-reload environment, use the commands documented in
[`README-Docker-Development.md`](README-Docker-Development.md); it exposes the
application at `http://localhost:3001`.

## Database migrations

The extension API expects its schema migrations to be applied before deployment.
Run the idempotent migrations explicitly; request handlers never run DDL:

```bash
psql "$DATABASE_URL" -f migrations/add-extension-prospects.sql
psql "$DATABASE_URL" -f migrations/add-extension-prospect-sources.sql
psql "$DATABASE_URL" -f migrations/add-extension-prospect-screening.sql
psql "$DATABASE_URL" -f migrations/add-extension-form-workflows.sql
psql "$DATABASE_URL" -f migrations/add-extension-submission-tracking.sql
psql "$DATABASE_URL" -f migrations/add-short-description-to-website-info.sql
```

The final migration adds submission tracking columns plus
`extension_generated_content`; it does not touch `partner_links`.

## Main application API

- `/api/websites` and `/api/websites/[id]`
- `/api/website-info` and `/api/website-info/[id]`
- `/api/resources` and `/api/resources/[id]`
- `/api/backlinks/[id]` and `/api/websites/[id]/backlinks`
- `/api/backlink-statuses`, `/api/website-categories`, `/api/stats`, `/api/health`
- `/api/partner-links` for the separate partner-link workflow

## Verification

```bash
npm run lint
npm run build
```

`npm run build` performs the production compilation and TypeScript validity
check. Deployment details, database backup commands, and Dokploy configuration
are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Manual backlink operations

The persistent `/operations` dashboard reuses the existing workspace and tracks each brand’s daily submissions, directory listings, FIFO resource verification, manual worklists and immutable report versions. No scheduler is installed. See [OPERATIONS.md](./OPERATIONS.md) for setup, API and operator instructions.
