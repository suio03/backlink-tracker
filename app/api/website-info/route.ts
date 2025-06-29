import { NextRequest, NextResponse } from 'next/server';
import { getAllWebsiteInfo, saveWebsiteInfo } from '@/lib/website-info';
import { WebsiteExtendedInfo } from '@/types';

// GET - Get all website extended info
export async function GET() {
  try {
    const websiteInfo = getAllWebsiteInfo();
    
    return NextResponse.json({
      success: true,
      data: websiteInfo
    });
  } catch (error) {
    console.error('Error fetching website info:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch website information'
      },
      { status: 500 }
    );
  }
}

// POST - Create or update website extended info
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.websiteId || typeof body.websiteId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          message: 'Website ID is required and must be a number'
        },
        { status: 400 }
      );
    }

    const websiteInfo: Omit<WebsiteExtendedInfo, 'lastUpdated'> = {
      websiteId: body.websiteId,
      supportEmail: body.supportEmail || undefined,
      title: body.title || undefined,
      description: body.description || undefined,
      url: body.url || undefined
    };

    const success = saveWebsiteInfo(websiteInfo);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Website information saved successfully'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to save website information'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error saving website info:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
} 