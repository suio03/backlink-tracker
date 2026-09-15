# Web backend

Follow the root AGENTS.md. Run app-local commands from this directory.

- Preserve PostgreSQL workspace contracts, API authentication and manual review fields.
- Operations workflows and account mapping are documented in ../../docs/operations.md.
- `tools/backlink-operations.mjs` resolves app-local ignored env files; its writes require --apply.
- The Docker build context is this directory. Existing Dockerfile and Compose paths are app-relative.
- Tests: `node --test tests/*.test.cjs`. Production validation: `npm run build`.
- Do not run dev and build against the same `.next` concurrently. Do not leave verification servers running.
