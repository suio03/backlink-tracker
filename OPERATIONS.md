# Operations guide

The maintained workflow, account mapping and project operating skill live in the local `backlink-desk` workspace at `docs/operations.md` and `.agents/skills/lyl-backlink-operator`. They are local shared instructions, not files in the standalone Web GitHub repository.

Run `node tools/backlink-operations.mjs read` from this app directory. After production deployment, set `BACKLINK_OPERATIONS_URL=https://backlink.actone.app`; authentication uses the existing ignored environment token. This command is read-only. Full deployment and verification instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).
