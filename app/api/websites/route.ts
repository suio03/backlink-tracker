/**
 * Websites API Routes
 * GET /api/websites - Get all websites with statistics  
 * POST /api/websites - Create new website
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getWebsitesWithStats } from '@/lib/queries';
import { query } from '@/lib/database';

export async function GET() {
  try {
    const websites = await getWebsitesWithStats();
    
    return NextResponse.json({
      data: websites,
      success: true
    });
  } catch (error) {
    console.error('Error fetching websites:', error);
    
    return NextResponse.json(
      {
        data: [],
        success: false,
        message: 'Failed to fetch websites'
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
      name,
      category
    } = body;

    // Validate required fields
    if (!domain || !name || !category) {
      return NextResponse.json(
        {
          success: false,
          message: 'Domain, name, and category are required'
        },
        { status: 400 }
      );
    }

    const sql = `
      INSERT INTO websites (domain, name, category, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const result = await query(sql, [domain, name, category]);

    return NextResponse.json({
      data: {
        id: result.rows[0].id,
        domain: result.rows[0].domain,
        name: result.rows[0].name,
        category: result.rows[0].category,
        created_at: result.rows[0].created_at,
        updated_at: result.rows[0].updated_at,
        is_active: result.rows[0].is_active
      },
      success: true,
      message: 'Website created successfully'
    });
  } catch (error: any) {
    console.error('Error creating website:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        {
          success: false,
          message: 'A website with this domain already exists'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create website'
      },
      { status: 500 }
    );
  }
} 