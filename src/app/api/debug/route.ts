import { NextRequest, NextResponse } from 'next/server';
import CacheManager from '@/lib/cache-manager';
import { getCachedSheetData, forceRefreshSheetCache } from '@/lib/sheet-cache';
import { validateColumns } from '@/lib/column-validation';
import { ROSTER_FIRST_DATA_ROW } from '@/lib/sheet-config';

/**
 * Debug: system and cache info. Optionally include roster lookup keys from the sheet (keys only, no PII).
 * GET /api/debug
 * GET /api/debug?rosterKeys=1       - include rosterLookupKeys: { count, keys[] } from sheet
 * GET /api/debug?rosterKeys=1&refresh=1 - force refresh sheet cache before returning keys
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeRosterKeys = searchParams.get('rosterKeys') === '1';
    const refreshSheet = searchParams.get('refresh') === '1';

    const cacheManager = CacheManager.getInstance();
    const debugData = await cacheManager.getDebugData(true);

    const response: Record<string, unknown> = debugData ?? {
      error: 'Failed to fetch debug data',
      unmatchedEmails: [],
      matchedEmails: [],
      totalMailingListEmails: 0,
      totalPlayerEmails: 0,
    };

    if (includeRosterKeys) {
      if (refreshSheet) {
        await forceRefreshSheetCache('ROSTER');
      }
      const rosterData = await getCachedSheetData('ROSTER');
      if (rosterData?.length) {
        const headerRow = rosterData[0];
        const columnMapping: Record<string, number> = {};
        for (let i = 0; i < headerRow.length; i++) {
          const name = headerRow[i]?.toString().trim();
          if (name) columnMapping[name] = i;
        }
        const validation = validateColumns(Object.keys(columnMapping));
        const lookupKeyColName = validation.portalColumns.lookupKey;
        const lookupKeyCol = lookupKeyColName != null ? columnMapping[lookupKeyColName] : undefined;
        if (lookupKeyCol != null) {
          const dataStartIndex = ROSTER_FIRST_DATA_ROW - 1;
          const keys: string[] = [];
          for (let i = dataStartIndex; i < rosterData.length; i++) {
            const key = rosterData[i][lookupKeyCol]?.toString().trim();
            if (key) keys.push(key);
          }
          response.rosterLookupKeys = { source: 'sheet', count: keys.length, keys };
        } else {
          response.rosterLookupKeys = { error: 'Portal Lookup Key column not found' };
        }
      } else {
        response.rosterLookupKeys = { error: 'No roster data from sheet' };
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      unmatchedEmails: [],
      matchedEmails: [],
      totalMailingListEmails: 0,
      totalPlayerEmails: 0,
    }, { status: 500 });
  }
}

