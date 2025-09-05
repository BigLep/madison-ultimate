import { NextResponse } from 'next/server';
import CacheManager from '@/lib/cache-manager';

export async function GET() {
  try {
    const cacheManager = CacheManager.getInstance();
    
    // Force refresh cache when debug is accessed
    const debugData = await cacheManager.getDebugData(true);

    if (!debugData) {
      return NextResponse.json(
        { error: 'Failed to fetch debug data' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(debugData);

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      unmatchedEmails: [],
      matchedEmails: [],
      totalMailingListEmails: 0,
      totalPlayerEmails: 0
    }, { status: 500 });
  }
}

