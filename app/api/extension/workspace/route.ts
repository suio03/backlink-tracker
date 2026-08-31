import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  applyExtensionWorkspacePatch,
  importExtensionProspectReport,
  loadExtensionWorkspace,
  ProspectReportInputError,
  type ProspectReportPayload,
  type WorkspacePatch,
} from '@/lib/extension-workspace';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
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

export async function GET(request: Request) {
  const rejection = authorize(request);
  if (rejection) return rejection;
  try {
    return json({ success: true, data: await loadExtensionWorkspace() });
  } catch (error) {
    console.error('Failed to load extension workspace:', error);
    return json({ success: false, message: 'Failed to load workspace' }, 500);
  }
}

export async function PATCH(request: Request) {
  const rejection = authorize(request);
  if (rejection) return rejection;
  try {
    const patch = (await request.json()) as WorkspacePatch;
    return json({
      success: true,
      data: await applyExtensionWorkspacePatch(patch),
    });
  } catch (error: unknown) {
    console.error('Failed to update extension workspace:', error);
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : '';
    return json(
      {
        success: false,
        message:
          code === '23505'
            ? 'A website or resource with this domain already exists'
            : 'Failed to update workspace',
      },
      code === '23505' ? 409 : 500,
    );
  }
}

export async function POST(request: Request) {
  const rejection = authorize(request);
  if (rejection) return rejection;
  try {
    const payload = (await request.json()) as ProspectReportPayload;
    return json({
      success: true,
      data: await importExtensionProspectReport(payload),
    });
  } catch (error: unknown) {
    console.error('Failed to import Semrush prospect report:', error);
    if (error instanceof ProspectReportInputError) {
      return json({ success: false, message: error.message }, 400);
    }
    return json(
      { success: false, message: 'Failed to import prospect report' },
      500,
    );
  }
}
