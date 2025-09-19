import { NextResponse } from 'next/server';
import { getPortalCacheStats, forceRefreshPortalCache } from '../../../../lib/portal-cache';

export async function GET() {
  try {
    const stats = getPortalCacheStats();

    return NextResponse.json({
      success: true,
      cacheStats: stats
    });
  } catch (error) {
    console.error('Error getting portal cache stats:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    await forceRefreshPortalCache();
    const stats = getPortalCacheStats();

    return NextResponse.json({
      success: true,
      message: 'Cache refreshed successfully',
      cacheStats: stats
    });
  } catch (error) {
    console.error('Error refreshing portal cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}