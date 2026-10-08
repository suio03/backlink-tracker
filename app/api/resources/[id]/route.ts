/**
 * Resource by ID API Routes
 * GET /api/resources/[id] - Get specific resource
 * PUT /api/resources/[id] - Update resource
 * DELETE /api/resources/[id] - Delete resource
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { mutateState } from '@/lib/d1-workspace-store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resourceId = parseInt(id);
    
    if (isNaN(resourceId)) {
      return NextResponse.json(
        {
          data: null,
          success: false,
          message: 'Invalid resource ID'
        },
        { status: 400 }
      );
    }
    
    const sql = `
      SELECT 
        r.*,
        COUNT(b.id) as backlink_count,
        COUNT(CASE WHEN b.status = 'live' THEN 1 END) as live_backlinks
      FROM resources r
      LEFT JOIN backlinks b ON r.id = b.resource_id
      WHERE r.id = $1 AND r.is_active = true
      GROUP BY r.id, r.domain, r.url, r.contact_email, r.domain_authority, r.category, r.cost, r.notes, r.created_at, r.updated_at, r.is_active;
    `;
    
    const result = await query(sql, [resourceId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          data: null,
          success: false,
          message: 'Resource not found'
        },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    
    return NextResponse.json({
      data: {
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
      },
      success: true
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    
    return NextResponse.json(
      {
        data: null,
        success: false,
        message: 'Failed to fetch resource'
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
    const resourceId = parseInt(id);
    
    if (isNaN(resourceId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid resource ID'
        },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const {
      domain,
      url,
      contact_email,
      domain_authority,
      category,
      cost,
      notes
    } = body;

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (domain !== undefined) {
      fields.push(`domain = $${paramIndex}`);
      values.push(domain);
      paramIndex++;
    }
    if (url !== undefined) {
      fields.push(`url = $${paramIndex}`);
      values.push(url);
      paramIndex++;
    }
    if (contact_email !== undefined) {
      fields.push(`contact_email = $${paramIndex}`);
      values.push(contact_email || null);
      paramIndex++;
    }
    if (domain_authority !== undefined) {
      fields.push(`domain_authority = $${paramIndex}`);
      values.push(domain_authority);
      paramIndex++;
    }
    if (category !== undefined) {
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
      fields.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex++;
    }
    if (cost !== undefined) {
      fields.push(`cost = $${paramIndex}`);
      values.push(cost);
      paramIndex++;
    }
    if (notes !== undefined) {
      fields.push(`notes = $${paramIndex}`);
      values.push(notes || null);
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
    fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);

    const sql = `
      UPDATE resources 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex} AND is_active = true
      RETURNING *;
    `;

    values.push(resourceId);

    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Resource not found or no changes made'
        },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    return NextResponse.json({
      data: {
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
        is_active: row.is_active
      },
      success: true,
      message: 'Resource updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating resource:', error);
    
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
        message: 'Failed to update resource'
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
    const resourceId = parseInt(id);
    
    if (isNaN(resourceId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid resource ID'
        },
        { status: 400 }
      );
    }
    
    const result = await mutateState(state=>{
      const resource=state.table('resources').find(r=>r.id===resourceId&&r.is_active);
      if(!resource)return null;
      const count=state.table('backlinks').filter(r=>r.resource_id===resourceId).length;
      state.remove('backlinks',r=>r.resource_id===resourceId);
      Object.assign(resource,{is_active:false,updated_at:state.now});return count;
    });
    if(result===null)return NextResponse.json({success:false,message:'Resource not found'},{status:404});
    return NextResponse.json({success:true,message:`Resource deleted successfully. Removed ${result} backlink tracking entries from all websites.`});

  } catch (error) {
    console.error('Error deleting resource:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete resource'
      },
      { status: 500 }
    );
  }
} 