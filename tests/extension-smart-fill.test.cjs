const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(fetch, env = { TYPESAFE_API_KEY: 'test-key', OPENAI_API_KEY: 'test-copy-key' }) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/extension-smart-fill.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, process: { env }, fetch, AbortSignal, require: () => ({ query: async () => ({ rowCount: 1, rows: [{ name: 'Test', domain: 'test.example' }] }) }) });
  return exports;
}
const field = (id, kind = 'text', extra = {}) => ({ id, kind, type: kind, label: id, section: '', group: '', required: false, maxLength: 100, options: [], ...extra });
function jev(body, choose = () => 'skip', confidence = 1) {
  return { model: 'jev-latest', answers: Object.fromEntries(Object.entries(body.questions).map(([id, q]) => { const choice = choose(id); return [id, { type: 'choice', choice, confidence, probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 1 : 0])) }]; })) };
}
function fake(choose, copy = { answers: [] }) {
  const calls = [];
  return { calls, fetch: async (url, options) => { const body = JSON.parse(options.body); calls.push({ url, body, options }); return { ok: true, json: async () => url.includes('typesafe') ? jev(body, choose) : { output_text: JSON.stringify(copy) } }; } };
}
test('radio group uses a single question, missing facts stay unknown', async () => {
  const f = fake(() => 'skip'), api = load(f.fetch);
  const result = await api.planSmartFill({ name: 'Demo' }, [field('f0','radio',{group:'g0',label:'Available'}),field('f1','radio',{group:'g0',label:'Not available'}),field('f2','checkbox',{label:'iOS App'})], 'auto');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(Object.keys(f.calls[0].body.questions), ['f2','g0']);
  assert.ok(result.suggestions.every(s => s.value === null));
});
test('identity uses exact stored data and checkbox sets false explicitly', async () => {
  const f = fake(id => id === 'f0' ? 'name' : 'no');
  const result = await load(f.fetch).planSmartFill({ name:'Demo' }, [field('f0'), field('f1','checkbox')], 'English');
  assert.equal(result.suggestions[0].value, 'Demo'); assert.equal(result.suggestions[1].value, false);
  assert.equal(f.calls.length, 1);
});
test('five features are generated together with per-field limits', async () => {
  const fields = Array.from({length:5}, (_,i) => field(`f${i}`,'text',{maxLength:300}));
  const f = fake(id => `feature${Number(id.slice(1))+1}`, {answers:fields.map((f,i)=>({id:f.id,value:`Verified feature ${i+1}`}))});
  const result = await load(f.fetch).planSmartFill({description:'Verified facts'}, fields, 'English');
  assert.equal(f.calls.length, 2); assert.equal(result.suggestions.length, 5);
  const input = JSON.parse(f.calls[1].body.input);
  assert.ok(input.fields.every(f=>f.field.maxLength===300));
  assert.equal(f.calls[1].body.store, false);
});
test('overlong model copy is not silently truncated or applied', async () => {
  const f = fake(()=>'title',{answers:[{id:'f0',value:'too long'}]});
  const result = await load(f.fetch).planSmartFill({},[field('f0','text',{maxLength:3})],'auto');
  assert.equal(result.suggestions[0].value,null);
});
test('unknown choice and malformed probability fail closed', async () => {
  const api = load(async()=>{});
  assert.throws(()=>api.readChoice({type:'choice',choice:'execute',confidence:1,probabilities:{skip:1}},{skip:'skip'}));
  assert.throws(()=>api.readChoice({type:'choice',choice:'skip',confidence:1,probabilities:{skip:-1}},{skip:'skip'}));
});
test('select options must exist and duplicates are rejected', () => {
  const api = load(async()=>{});
  assert.throws(()=>api.normalizeSmartFields([field('f0','select',{options:[{id:'o0'},{id:'o0'}]})]));
  assert.throws(()=>api.normalizeSmartFields([field('f0'),field('f0')]));
  assert.throws(()=>api.normalizeSmartFields([field('f0','text',{label:'Password'})]));
});
test('no configured API key means no external request', async () => {
  let calls=0; const api=load(async()=>{calls++},{});
  await assert.rejects(api.planSmartFill({},[field('f0')],'auto'), /TYPESAFE_API_KEY/);
  assert.equal(calls,0);
});
test('failed provider responses do not expose upstream content', async () => {
  const api=load(async()=>({ok:false,status:401,json(){throw Error('private upstream body')}}));
  await assert.rejects(api.planSmartFill({},[field('f0')],'auto'), /HTTP 401/);
});
test('low confidence leaves control unchanged', async () => {
  const api=load(async(url,opts)=>({ok:true,json:async()=>jev(JSON.parse(opts.body),()=> 'yes',0.2)}));
  const result=await api.planSmartFill({},[field('f0','checkbox')],'auto');
  assert.equal(result.suggestions[0].value,null);
});
test('model cannot inject extra generated fields', async () => {
  const f=fake(()=>'title',{answers:[{id:'f99',value:'injected'}]});
  await assert.rejects(load(f.fetch).planSmartFill({},[field('f0')],'auto'), /不匹配/);
});
function route(api, env) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/api/extension/smart-fill/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,process:{env},require(name){if(name==='node:crypto')return require(name);if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};return api;}});
  return exports;
}
test('route rejects unauthorized callers before models or database',async()=>{
  let calls=0;
  const handler=route({generateSmartFill:async()=>{calls++}},{BACKLINK_EXTENSION_TOKEN:'expected',TYPESAFE_API_KEY:'test'});
  const res=await handler.POST(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer wrong'},body:'{}'}));
  assert.equal(res.status,401);assert.equal(calls,0);
});
test('route bounds actual request body and rejects malformed JSON',async()=>{
  const api=load(async()=>{}); let calls=0;api.generateSmartFill=async()=>{calls++};
  const handler=route(api,{BACKLINK_EXTENSION_TOKEN:'expected',TYPESAFE_API_KEY:'test'});
  const request=body=>new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer expected'},body});
  assert.equal((await handler.POST(request('x'.repeat(100001)))).status,413);
  assert.equal((await handler.POST(request('not json'))).status,400);assert.equal(calls,0);
});

test('stored descriptions, features and categories work without a copy API key', async () => {
  const semantics = ['shortDescription','description','feature1','feature2','keywords','title'];
  const f = fake(id => semantics[Number(id.slice(1))]);
  const api = load(f.fetch, {TYPESAFE_API_KEY:'test'});
  const profile = { title:'Pixfy', shortDescription:'Create consistent characters from your reference images.', category:'- AI Character Generator\n- AI Image Editor', description:'## Introduction\nCreate new scenes from your saved characters.\n\n## Tagline\nOne reference. More looks.\n\n## Key Features\n- Save reusable references\n- Edit images with prompts\n\n## API Availability\nNot available' };
  const result = await api.planSmartFill(profile, semantics.map((_,i)=>field(`f${i}`)), 'English');
  assert.deepEqual(Array.from(result.suggestions, s=>s.value), [profile.shortDescription,'Create new scenes from your saved characters.','Save reusable references','Edit images with prompts','AI Character Generator, AI Image Editor','Pixfy']);
  assert.ok(result.suggestions.every(s=>s.source==='产品资料'));
  assert.equal(result.metrics.copyCalls,0); assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].body.state.productFacts.apiAvailability, 'Not available');
});
test('word ranges and requested translation route only incompatible copy to generation', async () => {
  const f = fake(id=>id==='f0'?'shortDescription':'title', {answers:[{id:'f0',value:'One two three four five'}]});
  const result = await load(f.fetch).planSmartFill({shortDescription:'Too short',title:'Pixfy'}, [field('f0','text',{label:'Short description (5–10 words)'}),field('f1')], 'English');
  assert.equal(result.suggestions[0].value,'One two three four five');
  assert.equal(result.suggestions[1].source,'产品资料');
  assert.equal(JSON.parse(f.calls[1].body.input).fields.length,1);
  const translate = fake(()=>'description',{answers:[{id:'f0',value:'这是已经保存的产品介绍。'}]});
  const translated=await load(translate.fetch).planSmartFill({description:'Saved English description'},[field('f0')],'Simplified Chinese');
  assert.equal(translated.metrics.copyCalls,1);
});
test('unconfigured copy service preserves valid saved fields and explains incompatible ones', async () => {
  const f=fake(id=>id==='f0'?'description':'shortDescription');
  const result=await load(f.fetch,{TYPESAFE_API_KEY:'test'}).planSmartFill({description:'Existing introduction',shortDescription:'Too short'},[field('f0'),field('f1','text',{label:'Short description (20-30 words)'})],'English');
  assert.equal(result.suggestions[0].value,'Existing introduction');
  assert.equal(result.suggestions[1].value,null);
  assert.match(result.suggestions[1].reason,/字数/);
  assert.equal(f.calls.length,1);
});
test('legacy flattened profile sections are parsed without leaking technical sections into copy', () => {
  const api=load(async()=>{});
  const profile=api.savedProfileFacts({description:'## Introduction Saved intro ## Key Features One feature ## API Availability Not available'});
  assert.equal(profile.introduction,'Saved intro');assert.equal(profile.keyFeatures,'One feature');
});
test('generated copy must also satisfy the word range', async () => {
  const f=fake(()=>'shortDescription',{answers:[{id:'f0',value:'Too short'}]});
  const result=await load(f.fetch).planSmartFill({},[field('f0','text',{label:'Short description (20-30 words)'})],'English');
  assert.equal(result.suggestions[0].value,null);
});
