/**
 * Website Backlinks API Route
 * GET /api/websites/[id]/backlinks - Get backlinks for a specific website
 */

import { NextResponse } from 'next/server';
import { getBacklinksByWebsiteId } from '@/lib/queries';

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
          data: [],
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }
    
    const backlinks = await getBacklinksByWebsiteId(websiteId);
    
    return NextResponse.json({
      data: backlinks,
      success: true
    });
  } catch (error) {
    console.error('Error fetching backlinks:', error);
    
    return NextResponse.json(
      {
        data: [],
        success: false,
        message: 'Failed to fetch backlinks'
      },
      { status: 500 }
    );
  }
} 