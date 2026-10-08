# Web backend

Run app-local commands from this directory. In the local combined workspace, also follow its root AGENTS.md.

- Preserve D1 workspace contracts, API authentication and manual review fields.
- Operations workflows and account mapping are documented in the local `backlink-desk/docs/operations.md` (shared instructions are not published in this standalone repository).
- `tools/backlink-operations.mjs` resolves app-local ignored env files; its writes require --apply.
- Production uses OpenNext on Cloudflare Workers with the `DB` D1 binding. Follow `DEPLOYMENT.md`; Docker/PostgreSQL files are historical.
- Tests: `node --test tests/*.test.cjs`. Production validation: `npm run build:worker`. Tests use isolated Miniflare/workerd D1.
- Do not run dev and build against the same `.next` concurrently. Do not leave verification servers running.
