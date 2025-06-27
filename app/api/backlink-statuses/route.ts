/**
 * Backlink Statuses API Routes
 * GET /api/backlink-statuses - Get all backlink statuses
 * POST /api/backlink-statuses - Create new status
 */

import { NextResponse } from 'next/server';

// In-memory storage for backlink statuses matching your schema constraint
const backlinkStatuses = [
  { id: 1, name: 'pending', description: 'Backlink request is pending', color: '#f59e0b', is_active: true },
  { id: 2, name: 'requested', description: 'Backlink has been requested', color: '#3b82f6', is_active: true },
  { id: 3, name: 'placed', description: 'Backlink has been placed but not yet live', color: '#8b5cf6', is_active: true },
  { id: 4, name: 'live', description: 'Backlink is live and active', color: '#10b981', is_active: true },
  { id: 5, name: 'removed', description: 'Backlink has been removed', color: '#ef4444', is_active: true },
  { id: 6, name: 'rejected', description: 'Backlink request was rejected', color: '#dc2626', is_active: true }
];

let nextId = 7;

export async function GET() {
  try {
    const activeStatuses = backlinkStatuses.filter(status => status.is_active);
    
    return NextResponse.json({
      data: activeStatuses,
      success: true
    });
  } catch (error) {
    console.error('Error fetching backlink statuses:', error);
    
    return NextResponse.json(
      {
        data: [],
        success: false,
        message: 'Failed to fetch backlink statuses'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, color } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: 'Status name is required'
        },
        { status: 400 }
      );
    }

    // Validate against schema constraint - must be one of the allowed values
    const allowedStatuses = ['pending', 'requested', 'placed', 'live', 'removed', 'rejected'];
    if (!allowedStatuses.includes(name.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          message: `Status must be one of: ${allowedStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Check if status already exists
    const existingStatus = backlinkStatuses.find(status => 
      status.name.toLowerCase() === name.toLowerCase() && status.is_active
    );
    
    if (existingStatus) {
      return NextResponse.json(
        {
          success: false,
          message: 'A status with this name already exists'
        },
        { status: 409 }
      );
    }

    // Create new status
    const newStatus = {
      id: nextId++,
      name: name.toLowerCase(),
      description: description || '',
      color: color || '#6b7280',
      is_active: true
    };

    backlinkStatuses.push(newStatus);

    return NextResponse.json({
      data: newStatus,
      success: true,
      message: 'Backlink status created successfully'
    });
  } catch (error) {
    console.error('Error creating backlink status:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to create backlink status'
      },
      { status: 500 }
    );
  }
} 