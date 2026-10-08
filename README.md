# Backlink Tracker

Next.js 15 and Cloudflare D1 application for managing owned websites, backlink
resources, and the submission relationship between every website and resource.
It also provides the authenticated backend used by the Backlink Desk Chrome
extension.

## Runtime architecture

- Next.js App Router with TypeScript and React 19.
- Cloudflare D1 through the Worker `DB` binding; no public database port.
- `websites`, `website_extended_info`, `resources`, and `backlinks` hold the
  primary tracker data.
- Extension-only prospect, source, learned-workflow, and generated-content data
  use separate `extension_*` tables.
- OpenNext on Cloudflare Workers is the production deployment path.

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
metadata from D1, then requests structured content from OpenAI. Set
`OPENAI_API_KEY` only in the backend environment. `OPENAI_CONTENT_MODEL` is
optional and defaults to `gpt-5-nano`; generated content is cached by the full
website/resource/model/language/form-field input hash.

## Environment

Copy `env.example` to ignored `.dev.vars` for local development. Production
credentials are Worker secrets. `BACKLINK_EXTENSION_TOKEN` authenticates the
extension and operations API; `PARTNER_LINKS_ADMIN_TOKEN` authenticates partner
writes; `OPENAI_API_KEY` enables copy generation. `DATABASE_URL` is not used.
Never commit tokens, API keys or database snapshots.

## Local development and schema

```bash
npm ci
npm run db:migrate:local
npm run dev
```

The application runs at `http://localhost:3000`. Migrations in `d1-migrations/`
are applied explicitly. Use `npm run db:migrate:remote` only for an intended
production schema change; request handlers never run DDL. Historical PostgreSQL
SQL in `migrations/` does not apply to D1.

## Main application API

- `/api/websites` and `/api/websites/[id]`
- `/api/website-info` and `/api/website-info/[id]`
- `/api/resources` and `/api/resources/[id]`
- `/api/backlinks/[id]` and `/api/websites/[id]/backlinks`
- `/api/backlink-statuses`, `/api/website-categories`, `/api/stats`, `/api/health`
- `/api/partner-links` for the separate partner-link workflow

## Verification

```bash
node --test tests/*.test.cjs
npm run build:worker
```

`npm run build:worker` compiles and validates the deployable Worker.
Deployment and backup instructions are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Manual backlink operations

The persistent `/operations` dashboard reuses the existing workspace and tracks each brand’s daily submissions, directory listings, FIFO resource verification, manual worklists and immutable report versions. No scheduler is installed. See [OPERATIONS.md](./OPERATIONS.md) for setup, API and operator instructions.

## Smart-fill automatic rewriting

Jev smart fill is optional and excluded from the 2026-10-08 migration at the
owner's request. The existing integration is retained but inactive without
`TYPESAFE_API_KEY`; it does not block other application or extension features.
To re-enable later, configure its key separately as a Worker secret. The copy
service uses `OPENAI_API_KEY` and `OPENAI_CONTENT_MODEL`.

Smart fill reuses saved copy that meets the field requirements. Otherwise it
sends the full product profile, existing copy and parsed word limits to the
copy model. Invalid or omitted answers get one automatic correction attempt;
valid answers are retained. Both calls share a bounded time budget. Provider
connection failures preserve other usable fields and show a retry message.
Without `OPENAI_API_KEY`, incompatible fields explain their actual word count
and the missing backend configuration; no automatic rewriting is claimed.
