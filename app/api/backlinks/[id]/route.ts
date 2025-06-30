/**
 * Backlink Update API Route
 * PATCH /api/backlinks/[id] - Update backlink details
 * DELETE /api/backlinks/[id] - Delete backlink
 */

import { NextResponse } from 'next/server';
import { updateBacklink, deleteBacklink } from '@/lib/queries';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backlinkId = parseInt(id);
    
    if (isNaN(backlinkId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid backlink ID'
        },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const {
      status,
      anchor_text,
      target_url,
      placement_date,
      removal_date,
      cost,
      notes
    } = body;
    
    // Validate status if provided
    if (status && !['pending', 'placed', 'live', 'removed', 'rejected'].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid status value'
        },
        { status: 400 }
      );
    }
    
    const updates: Record<string, string | number | null> = {};
    if (status !== undefined) updates.status = status;
    if (anchor_text !== undefined) updates.anchor_text = anchor_text;
    if (target_url !== undefined) updates.target_url = target_url;
    if (placement_date !== undefined) updates.placement_date = placement_date;
    if (removal_date !== undefined) updates.removal_date = removal_date;
    if (cost !== undefined) updates.cost = parseFloat(cost);
    if (notes !== undefined) updates.notes = notes;
    
    const success = await updateBacklink(backlinkId, updates);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to update backlink'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Backlink updated successfully'
    });
  } catch (error) {
    console.error('Error updating backlink:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to update backlink'
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
    const backlinkId = parseInt(id);
    
    if (isNaN(backlinkId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid backlink ID'
        },
        { status: 400 }
      );
    }
    
    const success = await deleteBacklink(backlinkId);
    
    if (!success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to delete backlink or backlink not found'
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Backlink deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting backlink:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete backlink'
      },
      { status: 500 }
    );
  }
} 