/**
 * Dashboard Stats API Route
 * GET /api/stats - Get overall statistics for the dashboard
 */

import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/queries';

export async function GET() {
  try {
    const stats = await getDashboardStats();
    
    return NextResponse.json({
      data: stats,
      success: true
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    
    return NextResponse.json(
      {
        data: {
          totalWebsites: 0,
          totalResources: 0,
          totalOpportunities: 0,
          liveBacklinks: 0,
          averageCompletionRate: 0
        },
        success: false,
        message: 'Failed to fetch statistics'
      },
      { status: 500 }
    );
  }
}