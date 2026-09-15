import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readOperations, mutateOperations, OperationsError } from '@/lib/backlink-operations';
import { dayInMelbourne } from '@/lib/backlink-operations-core';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status=200) => NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
function authorize(request: Request) {
  const expected = process.env.BACKLINK_EXTENSION_TOKEN;
  if(!expected) return json({message:'BACKLINK_EXTENSION_TOKEN 尚未配置'},503);
  const provided = request.headers.get('authorization')?.replace(/^Bearer /,'') || '';
  const a=Buffer.from(expected),b=Buffer.from(provided);
  if(a.length!==b.length || !timingSafeEqual(a,b)) return json({message:'请使用现有 Backlink Desk 访问令牌登录'},401);
  return null;
}
function failure(error: unknown) {
  if(error instanceof OperationsError) return json({message:error.message},error.status);
  return json({message:'操作失败，请检查数据库连接和迁移状态；未完成的事务已回滚'},500);
}
export async function GET(request: Request) {
  const rejected=authorize(request); if(rejected)return rejected;
  const params=new URL(request.url).searchParams;
  const day=params.get('day') || dayInMelbourne();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day) return json({message:'日期无效'},400);
  try { return json(await readOperations(day,params.get('snapshot') || undefined)); } catch(e) { return failure(e); }
}
export async function POST(request: Request) {
  const rejected=authorize(request); if(rejected)return rejected;
  if(!request.headers.get('content-type')?.includes('application/json')) return json({message:'需要 JSON 请求'},415);
  let input;
  try { const text=await request.text(); if(text.length>30000)return json({message:'请求过大'},413); input=JSON.parse(text); } catch {return json({message:'JSON 格式无效'},400);}
  if(!input || typeof input!=='object' || Array.isArray(input))return json({message:'无效请求'},400);
  try { return json(await mutateOperations(input)); } catch(e) { return failure(e); }
}
