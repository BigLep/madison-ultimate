import { NextRequest, NextResponse } from 'next/server';
import { getRosterMetadata } from '@/lib/roster-metadata';

export async function GET(request: NextRequest) {
  try {
    const metadata = await getRosterMetadata();
    
    return NextResponse.json({
      success: true,
      data: metadata,
    });
  } catch (error) {
    console.error('Error fetching roster metadata:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch roster metadata',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}