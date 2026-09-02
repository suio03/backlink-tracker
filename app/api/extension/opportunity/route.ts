import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  applyExtensionOpportunityDecision,
  OpportunityDecisionInputError,
  type OpportunityDecisionPayload,
} from '@/lib/extension-workspace';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Cache-Control': 'no-store',
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

function hasValidToken(request: Request): boolean {
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
  if (!hasValidToken(request)) {
    return json({ success: false, message: 'Unauthorized' }, 401);
  }
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(request: Request) {
  const rejection = authorize(request);
  if (rejection) return rejection;
  try {
    const payload = (await request.json()) as OpportunityDecisionPayload;
    return json({
      success: true,
      data: await applyExtensionOpportunityDecision(payload),
    });
  } catch (error: unknown) {
    console.error('Failed to update extension opportunity:', error);
    if (error instanceof OpportunityDecisionInputError) {
      return json({ success: false, message: error.message }, error.status);
    }
    return json(
      { success: false, message: 'Failed to update opportunity' },
      500,
    );
  }
}
