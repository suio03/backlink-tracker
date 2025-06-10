/**
 * Health Check API Endpoint
 * Used by Docker health checks and monitoring systems
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Add any additional health checks here
    // For example: database connectivity, external service checks, etc.
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
    
    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    return NextResponse.json(errorStatus, { status: 503 });
  }
}