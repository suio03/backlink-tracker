# Cloudflare Workers + D1 deployment

The production hostname is `https://backlink.actone.app`. OpenNext adapts the
Next.js app to Worker `backlink-desk`; its `DB` binding is D1 `backlink-desk`.
`wrangler.jsonc` routes `backlink.actone.app/*` to the Worker, with the existing
proxied DNS record retained for rollback. It is the deployment configuration. PostgreSQL `DATABASE_URL`
is no longer read by the application runtime.

## Develop and verify

```bash
npm ci
npm run db:migrate:local
npm run dev
node --test tests/*.test.cjs
npm run build:worker
```

Use an ignored `.dev.vars` for local secrets. Local D1 is isolated from
production. `npm run preview` builds and runs the actual Worker locally.
Tests exercise D1 through Miniflare/workerd, including atomic rollback,
concurrent writes and reports larger than D1's per-row limit.

## Deploy

Authenticate Wrangler to the existing Cloudflare account. Keep the existing
`BACKLINK_EXTENSION_TOKEN`, `PARTNER_LINKS_ADMIN_TOKEN`, and `OPENAI_API_KEY`
as Worker secrets (set with `npx wrangler secret put NAME`). Never include
secret values in command arguments, source control or build artifacts.
`OPENAI_CONTENT_MODEL` is a normal Wrangler variable.

```bash
npm run db:migrate:remote
npm run deploy
```

Do not create another database or rerun the data import on an existing database.
Jev smart fill is optional and was excluded from the migration on 2026-10-08;
`TYPESAFE_API_KEY` is not required for website management, extension workspace
sync, operations history or the partner-link API.

After deployment verify `/api/health` reports `database: "d1"`, the website and
resource pages load, authenticated workspace/operations reads succeed, and
unauthenticated workspace/operations reads return 401. Check partner links
for each product. Do not submit directories or create operations tasks as tests.

## Data and rollback

The 2026-10-08 migration preserves IDs, manual reviews, submission histories,
84 partner links and 43 historical reports. Reports are stored in bounded
`backlink_report_parts`; the API reconstructs the original JSON. Duplicate
legacy resource domains are preserved to avoid losing submission history.

A private PostgreSQL snapshot and pre-cutover DNS record are retained under
`.private/d1-migration/` in the local workspace, excluded from Git and build
contexts. `tools/import-d1.mjs` prepares SQL from that snapshot for a **new,
empty** D1 database. The old `migrations/` SQL and Docker files are historical
PostgreSQL artifacts; they are not the current deployment path.

The original Vercel deployment and Hetzner database are retained. The former
DNS record was proxied CNAME `backlink.actone.app` →
`backlink-tracker-theta.vercel.app` (TTL Auto). To roll back, first preserve any
new D1 writes and reconcile them; then remove the Worker hostname route, verify the retained DNS record and
restore the old application's restricted database access.
Do not silently revert to a stale PostgreSQL copy.

Production deploys now use Wrangler. Pushing the old Vercel Git integration is
not a Cloudflare release. Publish only `apps/web` to the original web remote;
never push the combined monorepo history to either split remote.
