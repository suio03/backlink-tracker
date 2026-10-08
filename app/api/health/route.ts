import { NextResponse } from 'next/server';
import { query } from '@/lib/database';
export async function GET() {
  try {
    await query('SELECT revision FROM workspace_revision WHERE id=1');
    return NextResponse.json({status:'healthy',database:'d1',timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({status:'unhealthy',database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
