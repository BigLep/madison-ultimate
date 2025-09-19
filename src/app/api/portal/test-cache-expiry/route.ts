import { NextResponse } from 'next/server';

// Test endpoint to verify cache behavior
export async function GET() {
  try {
    // Import the cache functions
    const { getPortalCache, getPortalCacheStats } = await import('../../../../lib/portal-cache');

    // Get initial stats
    const initialStats = getPortalCacheStats();

    // Get cached data (should be fast)
    const start1 = Date.now();
    await getPortalCache();
    const duration1 = Date.now() - start1;

    // Get cached data again (should be fast)
    const start2 = Date.now();
    await getPortalCache();
    const duration2 = Date.now() - start2;

    const finalStats = getPortalCacheStats();

    return NextResponse.json({
      success: true,
      test: 'cache-performance',
      initialStats,
      finalStats,
      timings: {
        firstCall: `${duration1}ms`,
        secondCall: `${duration2}ms`
      }
    });
  } catch (error) {
    console.error('Error testing cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}