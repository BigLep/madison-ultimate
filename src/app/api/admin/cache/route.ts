import { NextRequest, NextResponse } from 'next/server';
import {
  clearAllSheetCaches,
  clearSheetCache,
  forceRefreshSheetCache,
  getSheetCacheStats,
  SHEET_CACHE_CONFIG
} from '../../../../lib/sheet-cache';
import { forceRefreshPortalCache, getPortalCacheStats } from '../../../../lib/portal-cache';

export async function GET(request: NextRequest) {
  try {
    const sheetStats = getSheetCacheStats();
    const portalStats = getPortalCacheStats();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      caches: {
        sheets: sheetStats,
        portal: portalStats
      },
      configuration: SHEET_CACHE_CONFIG
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sheetType, range } = body;

    switch (action) {
      case 'clear-all':
        clearAllSheetCaches();
        return NextResponse.json({
          success: true,
          message: 'All sheet caches cleared'
        });

      case 'clear-sheet':
        if (!sheetType) {
          return NextResponse.json({
            success: false,
            error: 'sheetType is required for clear-sheet action'
          }, { status: 400 });
        }
        clearSheetCache(sheetType, range);
        return NextResponse.json({
          success: true,
          message: `Sheet cache cleared: ${sheetType}${range ? `:${range}` : ''}`
        });

      case 'refresh-sheet':
        if (!sheetType) {
          return NextResponse.json({
            success: false,
            error: 'sheetType is required for refresh-sheet action'
          }, { status: 400 });
        }
        await forceRefreshSheetCache(sheetType, range);
        return NextResponse.json({
          success: true,
          message: `Sheet cache refreshed: ${sheetType}${range ? `:${range}` : ''}`
        });

      case 'refresh-portal':
        await forceRefreshPortalCache();
        return NextResponse.json({
          success: true,
          message: 'Portal cache refreshed'
        });

      case 'refresh-all':
        // Clear and refresh all caches
        clearAllSheetCaches();

        // Refresh key caches
        await Promise.allSettled([
          forceRefreshSheetCache('ROSTER'),
          forceRefreshSheetCache('PRACTICE_INFO'),
          forceRefreshSheetCache('GAME_INFO'),
          forceRefreshSheetCache('PRACTICE_AVAILABILITY_PLAYERS'),
          forceRefreshSheetCache('GAME_AVAILABILITY_PLAYERS'),
          forceRefreshPortalCache()
        ]);

        return NextResponse.json({
          success: true,
          message: 'All caches cleared and refreshed'
        });

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}. Valid actions: clear-all, clear-sheet, refresh-sheet, refresh-portal, refresh-all`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}