import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateSmartFill, SmartFillInputError, SmartFillServiceError } from '@/lib/extension-smart-fill';
export const runtime = 'nodejs';
export const maxDuration = 120;
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers }); }
export async function POST(request: Request) {
  const token = process.env.BACKLINK_EXTENSION_TOKEN;
  if (!token) return json({ success: false, message: '后端尚未配置扩展鉴权。' }, 503);
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const expectedBytes = Buffer.from(token), actualBytes = Buffer.from(provided);
  if (!request.headers.get('authorization')?.startsWith('Bearer ') || expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) return json({ success: false, message: 'Unauthorized' }, 401);
  if (!process.env.TYPESAFE_API_KEY) return json({ success: false, message: '后端尚未配置 TYPESAFE_API_KEY。' }, 503);
  try {
    // Bound the actual stream, not just the caller-controlled Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) throw new SmartFillInputError('缺少填写请求。');
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > 100000) { await reader.cancel(); return json({ success: false, message: '表单信息过大，请缩小范围。' }, 413); }
      chunks.push(value);
    }
    let payload: unknown;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new SmartFillInputError('请求格式无效。'); }
    return json({ success: true, data: await generateSmartFill(payload) });
  } catch (error) {
    if (error instanceof SmartFillInputError) return json({ success: false, message: error.message }, 400);
    if (error instanceof SmartFillServiceError) return json({ success: false, message: error.message }, 502);
    return json({ success: false, message: '无法生成填写方案，请稍后重试。' }, 502);
  }
}
