/**
 * Websites API Route
 * GET /api/websites - Get all websites with statistics
 */

import { NextResponse } from 'next/server';
import { getWebsitesWithStats } from '@/lib/queries';

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