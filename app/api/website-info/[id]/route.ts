import { NextRequest, NextResponse } from 'next/server';
import { getWebsiteInfo, saveWebsiteInfo, deleteWebsiteInfo } from '@/lib/website-info';
import { WebsiteExtendedInfo } from '@/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// GET - Get website extended info by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const websiteId = parseInt(resolvedParams.id);
    
    if (isNaN(websiteId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }

    const websiteInfo = getWebsiteInfo(websiteId);
    
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

// PUT - Update website extended info
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const websiteId = parseInt(resolvedParams.id);
    
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

    const websiteInfo: Omit<WebsiteExtendedInfo, 'lastUpdated'> = {
      websiteId,
      supportEmail: body.supportEmail || undefined,
      title: body.title || undefined,
      description: body.description || undefined,
      url: body.url || undefined
    };

    const success = saveWebsiteInfo(websiteInfo);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Website information updated successfully'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to update website information'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating website info:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete website extended info
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;
    const websiteId = parseInt(resolvedParams.id);
    
    if (isNaN(websiteId)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid website ID'
        },
        { status: 400 }
      );
    }

    const success = deleteWebsiteInfo(websiteId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Website information deleted successfully'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to delete website information'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting website info:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
} 