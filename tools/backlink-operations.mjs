#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const file of ['.env.local','.env'])dotenv.config({path:path.join(root,file),quiet:true});
const args=process.argv.slice(2),command=args[0] || 'help';
if(!['read','write'].includes(command)){
 console.log('read [--day YYYY-MM-DD] [--snapshot ID]\nwrite <payload.json> [--apply]\nUses BACKLINK_OPERATIONS_URL and BACKLINK_EXTENSION_TOKEN; no scheduler.');process.exit(0);
}
try {
 const base=new URL(process.env.BACKLINK_OPERATIONS_URL || 'http://localhost:3195');
 if(!['localhost','127.0.0.1','backlink.actone.app'].includes(base.hostname) || base.username || base.password || !['http:','https:'].includes(base.protocol) || (base.hostname==='backlink.actone.app' && base.protocol!=='https:'))throw Error('Unsupported operations endpoint');
 const url=new URL('/api/operations',base);
 let payload;
 if(command==='write'){
  if(!args[1] || args[1].startsWith('--'))throw Error('Provide a JSON payload file');
  payload=JSON.parse(readFileSync(args[1],'utf8'));
  if(!args.includes('--apply')){console.log(JSON.stringify({dryRun:true,payload},null,2));process.exit(0);}
 }else for(const key of ['day','snapshot']) {const index=args.indexOf(`--${key}`);if(index>=0){if(!args[index+1])throw Error(`Missing ${key}`);url.searchParams.set(key,args[index+1]);}}
 const token=process.env.BACKLINK_EXTENSION_TOKEN;
 if(!token)throw Error('Configure BACKLINK_EXTENSION_TOKEN in ignored local env; do not paste it into chat');
 const response=await fetch(url,{method:command==='write'?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(60000),redirect:'error'});
 const result=await response.json();
 if(!response.ok)throw Error(result.message || `HTTP ${response.status}`);
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error?error.message:'Operation failed');process.exitCode=1;}
