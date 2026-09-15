# Web backend

Run app-local commands from this directory. In the local combined workspace, also follow its root AGENTS.md.

- Preserve PostgreSQL workspace contracts, API authentication and manual review fields.
- Operations workflows and account mapping are documented in the local `backlink-desk/docs/operations.md` (shared instructions are not published in this standalone repository).
- `tools/backlink-operations.mjs` resolves app-local ignored env files; its writes require --apply.
- The Docker build context is this directory. Existing Dockerfile and Compose paths are app-relative.
- Tests: `node --test tests/*.test.cjs`. Production validation: `npm run build`.
- Do not run dev and build against the same `.next` concurrently. Do not leave verification servers running.
