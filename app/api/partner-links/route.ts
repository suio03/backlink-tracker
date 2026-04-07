/**
 * Partner Links API Routes
 * GET  /api/partner-links?site=fablepilot.com  - Get active links for a site (used by Worker)
 * POST /api/partner-links                       - Create a new partner link
 */

import { NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const site = searchParams.get('site');

    if (!site) {
      return NextResponse.json(
        { error: 'site parameter is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT id, label, url, type, image_src, image_width, image_height FROM partner_links
       WHERE site = $1 AND is_active = true
       ORDER BY sort_order ASC, created_at ASC`,
      [site]
    );

    return NextResponse.json(result.rows, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 min cache
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to fetch partner links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { site, label, url, sort_order = 0, type = 'link', image_src, image_width, image_height } = body;

    if (!site || !label || !url) {
      return NextResponse.json(
        { error: 'site, label, and url are required' },
        { status: 400 }
      );
    }

    if (type === 'badge' && !image_src) {
      return NextResponse.json(
        { error: 'image_src is required for badge type' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO partner_links (site, label, url, sort_order, type, image_src, image_width, image_height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [site, label, url, sort_order, type, image_src || null, image_width || null, image_height || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create partner link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    await query('DELETE FROM partner_links WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete partner link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
