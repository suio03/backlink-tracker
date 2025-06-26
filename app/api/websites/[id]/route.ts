/**
 * Website by ID API Routes
 * GET /api/websites/[id] - Get specific website details
 * PUT /api/websites/[id] - Update website
 * DELETE /api/websites/[id] - Delete website
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { getWebsiteById } from '@/lib/queries';
import { query } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const websiteId = parseInt(id);
    
    if (isNaN(websiteId)) {
      return NextResponse.json(
        {
          data: null,
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }
    
    const website = await getWebsiteById(websiteId);
    
    if (!website) {
      return NextResponse.json(
        {
          data: null,
          success: false,
          message: 'Website not found'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      data: website,
      success: true
    });
  } catch (error) {
    console.error('Error fetching website:', error);
    
    return NextResponse.json(
      {
        data: null,
        success: false,
        message: 'Failed to fetch website'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const websiteId = parseInt(id);
    
    if (isNaN(websiteId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { domain, name, category } = body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (domain !== undefined) {
      fields.push(`domain = $${paramIndex}`);
      values.push(domain);
      paramIndex++;
    }
    if (name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (category !== undefined) {
      fields.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }

    if (fields.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No fields to update'
        },
        { status: 400 }
      );
    }

    // Add updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE websites 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND is_active = true
      RETURNING *;
    `;

    values.push(websiteId);

    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Website not found or no changes made'
        },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    return NextResponse.json({
      data: {
        id: row.id,
        domain: row.domain,
        name: row.name,
        category: row.category,
        created_at: row.created_at,
        updated_at: row.updated_at,
        is_active: row.is_active
      },
      success: true,
      message: 'Website updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating website:', error);
    
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
        message: 'Failed to update website'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const websiteId = parseInt(id);
    
    if (isNaN(websiteId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }
    
    // Soft delete - set is_active to false
    const sql = `
      UPDATE websites 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_active = true
      RETURNING id;
    `;
    
    const result = await query(sql, [websiteId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Website not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Website deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting website:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete website'
      },
      { status: 500 }
    );
  }
} 