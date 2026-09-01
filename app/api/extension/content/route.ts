import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  ExtensionContentInputError,
  generateExtensionContent,
  type ExtensionContentPayload,
} from '@/lib/extension-content';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.BACKLINK_EXTENSION_TOKEN;
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

function authorize(request: Request) {
  if (!process.env.BACKLINK_EXTENSION_TOKEN) {
    return json(
      { success: false, message: 'BACKLINK_EXTENSION_TOKEN is not configured' },
      503,
    );
  }
  return isAuthorized(request)
    ? null
    : json({ success: false, message: 'Unauthorized' }, 401);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const rejection = authorize(request);
  if (rejection) return rejection;
  if (!process.env.OPENAI_API_KEY) {
    return json(
      { success: false, message: 'OPENAI_API_KEY is not configured on the backend' },
      503,
    );
  }
  try {
    const payload = (await request.json()) as ExtensionContentPayload;
    return json({
      success: true,
      data: await generateExtensionContent(payload),
    });
  } catch (error) {
    console.error('Failed to generate extension content:', error);
    if (error instanceof ExtensionContentInputError) {
      return json({ success: false, message: error.message }, 400);
    }
    return json(
      { success: false, message: 'Failed to generate submission content' },
      502,
    );
  }
}
