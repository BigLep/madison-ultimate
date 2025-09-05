import { NextResponse } from 'next/server';
import CacheManager from '@/lib/cache-manager';

export async function GET() {
  try {
    const cacheManager = CacheManager.getInstance();
    const data = await cacheManager.getIntegratedData();

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch player data' }, 
        { status: 500 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Players API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      players: [],
      statistics: null,
      timestamps: null
    }, { status: 500 });
  }
}

