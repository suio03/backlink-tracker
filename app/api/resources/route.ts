/**
 * Resources API Routes
 * GET /api/resources - Get all resources with filtering
 * POST /api/resources - Create new resource
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      whereClause += ` AND r.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (r.domain ILIKE $${paramIndex} OR r.url ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const sql = `
      SELECT 
        r.*,
        COUNT(b.id) as backlink_count,
        COUNT(CASE WHEN b.status = 'live' THEN 1 END) as live_backlinks
      FROM resources r
      LEFT JOIN backlinks b ON r.id = b.resource_id
      ${whereClause}
      GROUP BY r.id, r.domain, r.url, r.contact_email, r.domain_authority, r.category, r.cost, r.notes, r.created_at, r.updated_at, r.is_active
      ORDER BY r.domain_authority DESC, r.domain
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    params.push(limit, offset);

    const countSql = `
      SELECT COUNT(*) as total
      FROM resources r
      ${whereClause};
    `;

    const [resourcesResult, countResult] = await Promise.all([
      query(sql, params.slice(0, -2).concat([limit, offset])),
      query(countSql, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: resourcesResult.rows.map((row: any) => ({
        id: row.id,
        domain: row.domain,
        url: row.url,
        contact_email: row.contact_email || undefined,
        domain_authority: parseInt(row.domain_authority) || 0,
        category: row.category,
        cost: parseFloat(row.cost) || 0,
        notes: row.notes || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_active: row.is_active,
        backlink_count: parseInt(row.backlink_count) || 0,
        live_backlinks: parseInt(row.live_backlinks) || 0
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      success: true
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    
    return NextResponse.json(
      {
        data: [],
        success: false,
        message: 'Failed to fetch resources'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      domain,
      url,
      contact_email,
      domain_authority = 0,
      category,
      cost = 0,
      notes
    } = body;

    // Validate required fields
    if (!domain || !url || !category) {
      return NextResponse.json(
        {
          success: false,
          message: 'Domain, URL, and category are required'
        },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['ai-directory', 'tools-directory', 'startup-directory', 'saas-directory', 'project-directory'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid category'
        },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO resources (domain, url, contact_email, domain_authority, category, cost, notes, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await query(sql, [
      domain,
      url,
      contact_email || null,
      domain_authority,
      category,
      cost,
      notes || null
    ]);

    return NextResponse.json({
      data: {
        id: result.rows[0].id,
        domain: result.rows[0].domain,
        url: result.rows[0].url,
        contact_email: result.rows[0].contact_email || undefined,
        domain_authority: parseInt(result.rows[0].domain_authority) || 0,
        category: result.rows[0].category,
        cost: parseFloat(result.rows[0].cost) || 0,
        notes: result.rows[0].notes || undefined,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at,
        is_active: result.rows[0].is_active
      },
      success: true,
      message: 'Resource created successfully'
    });
  } catch (error: any) {
    console.error('Error creating resource:', error);
    
    if (error.code === '23505' && error.constraint === 'resources_domain_unique') {
      return NextResponse.json(
        {
          success: false,
          message: 'A resource with this domain already exists'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create resource'
      },
      { status: 500 }
    );
  }
} 