const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');

async function setup(unique) {
  const db = new PGlite();
  const schema = fs.readFileSync(path.join(root, 'database/schema-postgresql.sql'), 'utf8')
    .replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g, '')
    .replace(/CREATE INDEX IF NOT EXISTS idx_resources_domain_trgm[^;]+;/g, '');
  await db.exec(schema);
  if (!unique) await db.exec('ALTER TABLE resources DROP CONSTRAINT resources_domain_unique');
  for (const file of ['add-extension-prospects.sql', 'add-extension-prospect-sources.sql', 'add-extension-prospect-screening.sql', 'add-extension-submission-tracking.sql', 'add-extension-form-workflows.sql']) {
    await db.exec(fs.readFileSync(path.join(root, 'migrations', file), 'utf8'));
  }
  await db.exec("INSERT INTO websites(domain,name,category) VALUES ('product.example','Product','AI');");
  const database = { query: (sql, args) => db.query(sql, args), transaction: fn => db.transaction(tx => fn({query: async (sql,args) => {const r=await tx.query(sql,args);return {...r,rowCount:r.affectedRows};}})) };
  const exports = {};
  const source = fs.readFileSync(path.join(root, 'lib/extension-workspace.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: name => { assert.equal(name, '@/lib/database'); return database; } });
  return { db, patch: exports.applyExtensionWorkspacePatch };
}

for (const unique of [false, true]) {
  test(`resource creation and duplicate protection with domain unique constraint=${unique}`, async () => {
    const { db, patch } = await setup(unique);
    try {
      if (!unique) {
        // Reproduce the old production failure without inserting any rows.
        await assert.rejects(db.query("INSERT INTO resources(domain) VALUES ('broken.example') ON CONFLICT (domain) DO UPDATE SET domain=EXCLUDED.domain"), error => error.code === '42P10');
      }
      const websiteId = (await db.query("SELECT id FROM websites WHERE domain='product.example'")).rows[0].id;
      const payload = { resources: { upsert: [{ id: 'resource-new', domain: 'directory.example', url: 'https://directory.example/submit', active: true }] }, submissions: { upsert: [{ id: 'submission-new', websiteId: String(websiteId), resourceId: 'resource-new', status: 'pending' }] } };
      const result = await patch(payload);
      const resource = result.resources.find(r => r.domain === 'directory.example');
      assert.ok(resource);
      assert.equal(result.submissions.filter(s => s.resourceId === resource.id && s.websiteId === String(websiteId)).length, 1);
      await db.query("UPDATE resources SET notes='keep existing notes' WHERE id=$1", [resource.id]);
      await db.query("UPDATE backlinks SET status='live',live_url='https://directory.example/product' WHERE resource_id=$1", [resource.id]);
      payload.resources.upsert[0].domain = 'DIRECTORY.EXAMPLE';
      await assert.rejects(patch(payload), error => error.code === '23505');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM resources')).rows[0].n, 1);
      assert.equal((await db.query('SELECT notes FROM resources')).rows[0].notes, 'keep existing notes');
      assert.equal((await db.query('SELECT status FROM backlinks')).rows[0].status, 'live');
    } finally { await db.close(); }
  });
}
