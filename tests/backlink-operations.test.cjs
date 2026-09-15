const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..');
function moduleFrom(file,deps={}) {
 const output=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};vm.runInNewContext(output,{exports,require(name){if(name in deps)return deps[name];if(name==='node:crypto')return require(name);throw Error(`Unexpected import ${name}`);},Date,Intl,URL,Set,Map,Buffer,console,process});return exports;
}
const core=moduleFrom('lib/backlink-operations-core.ts');
const day=core.dayInMelbourne();
test('Melbourne date handles midnight and daylight saving; invalid dates stay unknown',()=>{
 assert.equal(core.dayInMelbourne('2026-09-13T14:01:00Z'),'2026-09-14');
 assert.equal(core.dayInMelbourne('2026-12-13T13:01:00Z'),'2026-12-14');
 assert.equal(core.dayInMelbourne(''),'');
});
test('verification of undated historical live links does not count as a new submission',()=>{
 assert.equal(core.submissionDate({status:'live',statusHistory:[{status:'live',at:new Date().toISOString()}]}),'');
 assert.ok(core.hasSubmission({status:'live'}));
 assert.equal(core.httpUrl('javascript:alert(1)'), '');
 assert.equal(core.httpUrl('https://user:password@example.com'), '');
});
async function setup(migrate=true) {
 const db=new PGlite();
 let schema=fs.readFileSync(path.join(root,'database/schema-postgresql.sql'),'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g,'').replace(/CREATE INDEX IF NOT EXISTS idx_resources_domain_trgm[^;]+;/g,'');
 await db.exec(schema);
 for(const file of ['add-extension-prospects.sql','add-extension-prospect-sources.sql','add-extension-prospect-screening.sql','add-extension-submission-tracking.sql','add-extension-form-workflows.sql'])await db.exec(fs.readFileSync(path.join(root,'migrations',file),'utf8'));
 if(migrate){const migration=fs.readFileSync(path.join(root,'migrations/add-backlink-operations.sql'),'utf8');await db.exec(migration);await db.exec(migration);}
 const database={query:(sql,args)=>db.query(sql,args),transaction:fn=>db.transaction(tx=>fn({query:(sql,args)=>tx.query(sql,args)}))};
 const workspace=moduleFrom('lib/extension-workspace.ts',{'@/lib/database':database});
 const service=moduleFrom('lib/backlink-operations.ts',{'@/lib/database':database,'@/lib/extension-workspace':workspace,'@/lib/backlink-operations-core':core});
 await db.exec("INSERT INTO websites(domain,name,category) VALUES('pixfy.io','Pixfy','AI'),('scribix.io','Scribix','AI'),('fablepilot.com','FablePilot','AI');");
 return {db,service};
}
test('read-only legacy view works before migration',async()=>{
 const {db,service}=await setup(false);
 try{const data=await service.readOperations(day);assert.equal(data.ready,false);assert.equal(data.report.sites.length,3);await assert.rejects(service.mutateOperations({action:'start'}),/迁移/);}finally{await db.close();}
});
test('real SQL lifecycle: FIFO, dedup, independent 5-per-site quotas, failures, snapshots and evidence',async()=>{
 const {db,service}=await setup();
 try {
  await db.exec("INSERT INTO extension_prospects(root_domain,status,notes,import_order,created_at) VALUES('old.example','can_add','preserve manual decision',0,'2020-01-01');");
  await service.mutateOperations({action:'add',urls:'old.example\nnew.example\nnew.example/other'});
  let report=(await service.readOperations(day)).report;
  assert.equal(report.resources.length,2);assert.equal(report.resources[0].domain,'old.example');
  assert.equal((await db.query("SELECT notes FROM extension_prospects WHERE root_domain='old.example'")).rows[0].notes,'preserve manual decision');
  // Confirmed historical resources remain visible but are not assumed free.
  assert.equal(report.resources[0].status,'confirmed');
  assert.equal(report.sites[0].candidates.length,0);
  for(let i=0;i<7;i++) {
   const domain=i===0?'old.example':`directory${i}.example`;
   if(i)await service.mutateOperations({action:'add',urls:domain});
   await service.mutateOperations({action:'review',domain,result:'free',entryUrl:`https://${domain}/submit`,note:'Public free submission form verified'});
  }
  report=(await service.readOperations(day)).report;
  assert.equal(report.resources[0].domain,'old.example','promotion preserves original queue position');
  const started=await service.mutateOperations({action:'start'});
  const repeated=await service.mutateOperations({action:'start'});
  assert.equal(started.runId,repeated.runId);
  report=(await service.readOperations(day)).report;
  assert.deepEqual(Array.from(report.sites,s=>s.reserved),[5,5,5]);
  await assert.rejects(service.mutateOperations({action:'close',runId:started.runId}),/待办/);
  const first=report.sites[0].blockers[0];
  const permit=await service.mutateOperations({action:'preflight',attemptId:first.id});
  assert.equal(permit.website,'pixfy.io');
  await service.mutateOperations({action:'attempt',attemptId:first.id,result:'uncertain',note:'Timeout after pressing submit'});
  await assert.rejects(service.mutateOperations({action:'preflight',attemptId:first.id}),/已有结果/);
  await service.mutateOperations({action:'start'});
  report=(await service.readOperations(day)).report;assert.equal(report.sites[0].reserved,5);
  await service.mutateOperations({action:'attempt',attemptId:first.id,result:'failed',note:'Verified directory did not receive submission'});
  await service.mutateOperations({action:'start'});
  report=(await service.readOperations(day)).report;
  assert.equal(report.sites[0].reserved,5);assert.ok(!report.sites[0].blockers.some(a=>a.id===first.id));
  for(const a of report.sites[0].blockers)await service.mutateOperations({action:'attempt',attemptId:a.id,result:'submitted',evidenceUrl:'https://directory.example/thanks',note:'Accepted, awaiting review'});
  await service.mutateOperations({action:'start'});
  report=(await service.readOperations(day)).report;
  assert.deepEqual(Array.from(report.sites,s=>s.today),[5,0,0]);assert.equal(report.sites[0].reserved,0);assert.equal(report.sites[1].reserved,5);
  const submitted=report.sites[0].attempts.find(a=>a.status==='submitted');
  await service.mutateOperations({action:'attempt',attemptId:submitted.id,result:'submitted',evidenceUrl:'https://directory.example/thanks',note:'retry same API call'});
  report=(await service.readOperations(day)).report;assert.equal(report.sites[0].today,5);
  const extraId=require('node:crypto').randomUUID();
  await db.query("INSERT INTO backlink_operation_attempts(id,run_id,website_id,resource_id,status) VALUES($1,$2,1,7,'reserved')",[extraId,started.runId]);
  await assert.rejects(service.mutateOperations({action:'attempt',attemptId:extraId,result:'submitted',evidenceUrl:'https://directory.example/thanks',note:'Sixth attempt'}),/达到 5/);
  await assert.rejects(service.mutateOperations({action:'preflight',attemptId:extraId}),/达标/);
  await db.query('DELETE FROM backlink_operation_attempts WHERE id=$1',[extraId]);
  const savedId=String(report.reports[0].id);
  const before=JSON.stringify((await service.readOperations(day,savedId)).report);
  const record=report.sites[0].records[0];
  await assert.rejects(service.mutateOperations({action:'check',websiteId:'1',resourceId:record.resourceId,result:'listed',evidenceUrl:'https://directory.example/product',targetUrl:'https://scribix.io',note:'wrong brand'}),/正确网站/);
  await service.mutateOperations({action:'check',websiteId:'1',resourceId:record.resourceId,result:'listed',evidenceUrl:'https://directory.example/product',targetUrl:'https://pixfy.io/',rel:'nofollow',note:'Public listing has correct product and link'});
  report=(await service.readOperations(day)).report;
  assert.equal(report.sites[0].records.find(r=>r.id===record.id).verification,'listed');assert.equal(report.sites[0].today,5);
  await service.mutateOperations({action:'check',websiteId:'1',resourceId:record.resourceId,result:'unreachable',note:'HTTP 503, retry later'});
  report=(await service.readOperations(day)).report;
  const after=report.sites[0].records.find(r=>r.id===record.id);
  assert.equal(after.verification,'unreachable');assert.equal(after.status,'live','transient failure does not erase live history');
  assert.equal(JSON.stringify((await service.readOperations(day,savedId)).report),before,'saved report immutable');
  assert.equal((await db.query("SELECT notes,status FROM extension_prospects WHERE root_domain='old.example'")).rows[0].status,'can_add');
  const count=(await db.query('SELECT count(*) AS n FROM extension_prospects')).rows[0].n;
  await assert.rejects(service.mutateOperations({action:'add',urls:'valid.example\nnot a url'}),/无效/);
  assert.equal((await db.query('SELECT count(*) AS n FROM extension_prospects')).rows[0].n,count,'bad batch rolls back all inserts');
 }finally{await db.close();}
});

test('operations HTTP boundary requires auth and rejects invalid dates / payloads',async()=>{
 const previous=process.env.BACKLINK_EXTENSION_TOKEN;
 process.env.BACKLINK_EXTENSION_TOKEN='isolated-test-token';
 let reads=0,writes=0;
 const service={OperationsError:class extends Error{},readOperations:async()=>{reads++;return {ready:true};},mutateOperations:async()=>{writes++;return {ok:true};}};
 const api=moduleFrom('app/api/operations/route.ts',{'next/server':require('next/server'),'@/lib/backlink-operations':service,'@/lib/backlink-operations-core':core});
 const headers={Authorization:'Bearer isolated-test-token','Content-Type':'application/json'};
 try{
  assert.equal((await api.GET(new Request('http://localhost/api/operations'))).status,401);
  assert.equal((await api.GET(new Request('http://localhost/api/operations?day=2026-02-30',{headers}))).status,400);
  assert.equal((await api.GET(new Request('http://localhost/api/operations',{headers}))).status,200);
  assert.equal(reads,1);
  assert.equal((await api.POST(new Request('http://localhost/api/operations',{method:'POST',headers,body:'[]'}))).status,400);
  assert.equal((await api.POST(new Request('http://localhost/api/operations',{method:'POST',headers,body:'{'}))).status,400);
  assert.equal(writes,0);
  assert.equal((await api.POST(new Request('http://localhost/api/operations',{method:'POST',headers,body:'{"action":"start"}'}))).status,200);
  assert.equal(writes,1);
 }finally{if(previous===undefined)delete process.env.BACKLINK_EXTENSION_TOKEN;else process.env.BACKLINK_EXTENSION_TOKEN=previous;}
});
