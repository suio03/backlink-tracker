const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');

async function setup(unique) {
 const env=await require('./d1-harness.cjs').setup();
 if(unique)await env.db.exec('CREATE UNIQUE INDEX resource_domain_test ON resources(domain);');
 await env.db.exec("INSERT INTO websites(domain,name,category) VALUES ('product.example','Product','AI');");
 return {...env,patch:env.workspace.applyExtensionWorkspacePatch,decide:env.workspace.applyExtensionOpportunityDecision};
}

for (const unique of [false, true]) {
  test(`resource creation and duplicate protection with domain unique constraint=${unique}`, async () => {
    const { db, patch } = await setup(unique);
    try {
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
      assert.equal((await db.query('SELECT count(*) AS n FROM resources')).rows[0].n, 1);
      assert.equal((await db.query('SELECT notes FROM resources')).rows[0].notes, 'keep existing notes');
      assert.equal((await db.query('SELECT status FROM backlinks')).rows[0].status, 'live');
    } finally { await db.close(); }
  });
}

for (const unique of [false, true]) {
  test(`confirm opportunity preserves history and is idempotent with domain unique constraint=${unique}`, async () => {
    const { db, decide } = await setup(unique);
    try {
      await db.query("INSERT INTO extension_prospects(root_domain,authority,status) VALUES ('saascity.io',16,'pending')");
      const result = await decide({action:'confirm',rootDomain:'saascity.io'});
      assert.equal(result.prospect.status, 'can_add');
      assert.equal(result.resource.domain, 'saascity.io');
      assert.equal(result.submissions.length, 1);
      await db.query("UPDATE resources SET domain='SAASCITY.IO',notes='keep review' WHERE id=$1", [result.resource.id]);
      await db.query("UPDATE backlinks SET status='live',live_url='https://saascity.io/product' WHERE resource_id=$1", [result.resource.id]);
      const again = await decide({action:'confirm',rootDomain:'saascity.io'});
      assert.equal(again.resource.id, result.resource.id);
      assert.equal(again.resource.notes, 'keep review');
      assert.equal((await db.query('SELECT count(*) AS n FROM resources')).rows[0].n, 1);
      assert.equal((await db.query('SELECT status FROM backlinks')).rows[0].status, 'live');
    } finally { await db.close(); }
  });
}
