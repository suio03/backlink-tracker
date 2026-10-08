const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');

test('smart-fill POST and redirect rejection run in workerd', async () => {
  const bundle = await build({
    stdin: { contents: `import { planSmartFill } from './lib/extension-smart-fill';
      export default { async fetch(request) { try {
        const result = await planSmartFill(await request.json(), [{id:'f0',kind:'text',type:'text',label:'Product name',section:'',group:'',required:true,maxLength:100,options:[]}], 'English');
        return Response.json(result);
      } catch (e) { return new Response(e.message, {status:503}); } } };`,
      resolveDir: path.join(__dirname, '..'), loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'neutral',
    define: { 'process.env': JSON.stringify({ TYPESAFE_API_KEY: 'local-test-only' }) },
    plugins: [{name:'isolated-database',setup(b){b.onResolve({filter:/^@\/lib\/database$/},()=>({path:'database',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export function query(){throw Error("Unexpected database access");}'}));}}],
  });
  let calls = 0;
  const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-08',outboundService:async request=>{
    calls++;
    assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(request.method, 'POST');
    const body = await request.json();
    if(body.state.productFacts.redirect) return new Response(null,{status:302,headers:{Location:'https://untrusted.example/'}});
    const criteria=body.questions.f0.criteria;
    return Response.json({model:'jev-latest',answers:{f0:{type:'choice',choice:'name',confidence:1,probabilities:Object.fromEntries(Object.keys(criteria).map(k=>[k,k==='name'?1:0]))}}});
  }}));
  try {
    const result = await mf.dispatchFetch('https://test/',{method:'POST',body:JSON.stringify({name:'Demo'})});
    assert.equal(result.status,200);
    assert.equal((await result.json()).suggestions[0].value,'Demo');
    const redirect = await mf.dispatchFetch('https://test/',{method:'POST',body:JSON.stringify({name:'Demo',redirect:true})});
    assert.equal(redirect.status,503);
    assert.match(await redirect.text(),/HTTP 302/);
    assert.equal(calls,2);
  } finally { await mf.dispose(); }
});
