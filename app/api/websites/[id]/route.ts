/**
 * Website by ID API Route
 * GET /api/websites/[id] - Get specific website details
 */

import { NextResponse } from 'next/server';
import { getWebsiteById } from '@/lib/queries';

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