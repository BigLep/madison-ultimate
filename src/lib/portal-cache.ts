import { getSheetData, getSheetMetadata } from './google-api';
import { SHEET_CONFIG } from './sheet-config';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface PortalEntry {
  lookupKey: string;
  portalId: string;
  rowIndex: number; // For debugging and reference
}

interface PortalCache {
  data: PortalEntry[];
  lastUpdated: number;
  isRefreshing: boolean;
}

// In-memory cache
let portalCache: PortalCache = {
  data: [],
  lastUpdated: 0,
  isRefreshing: false
};

// Active refresh promises to prevent duplicate fetches
let refreshPromise: Promise<void> | null = null;

/**
 * Get cached portal data, refreshing if needed.
 * Blocks the request until cache is fresh if stale.
 */
export async function getPortalCache(): Promise<PortalEntry[]> {
  const now = Date.now();
  const isStale = now - portalCache.lastUpdated > CACHE_DURATION;

  if (isStale) {
    // If cache is stale, block until we refresh
    await refreshPortalCache();
  }

  return portalCache.data;
}

/**
 * Refresh the portal cache from Google Sheets
 */
async function refreshPortalCache(): Promise<void> {
  // If already refreshing, wait for that operation
  if (refreshPromise) {
    return refreshPromise;
  }

  portalCache.isRefreshing = true;

  refreshPromise = (async () => {
    try {
      console.log('Refreshing portal cache...');

      // Step 1: Get sheet metadata to understand dimensions
      const sheetMetadata = await getSheetMetadata(ROSTER_SHEET_ID);
      if (!sheetMetadata) {
        throw new Error('Unable to fetch sheet metadata');
      }

      // Find the main roster sheet
      const rosterSheet = sheetMetadata.sheets.find(sheet =>
        sheet.title === SHEET_CONFIG.ROSTER_SHEET_NAME || sheet.title.includes('Roster')
      ) || sheetMetadata.sheets[0]; // fallback to first sheet

      if (!rosterSheet) {
        throw new Error('No roster sheet found');
      }

      console.log(`Found roster sheet: "${rosterSheet.title}" with ${rosterSheet.rowCount} rows and ${rosterSheet.columnCount} columns`);

      // Step 2: Get metadata to find Portal columns (use actual sheet dimensions)
      const maxColumn = Math.min(rosterSheet.columnCount, 702); // 702 = ZZ column, reasonable limit
      function getColumnLetterForIndex(index: number): string {
        let result = '';
        while (index >= 0) {
          result = String.fromCharCode(65 + (index % 26)) + result;
          index = Math.floor(index / 26) - 1;
        }
        return result;
      }
      const columnLetter = getColumnLetterForIndex(maxColumn - 1);
      const metadataRange = `A1:${columnLetter}4`;  // Use actual column range
      const metadataRows = await getSheetData(ROSTER_SHEET_ID, metadataRange);

      if (metadataRows.length < 4) {
        throw new Error('Invalid roster metadata structure');
      }

      const [columnNameRow] = metadataRows;

      // Find Portal columns dynamically
      let lookupKeyIndex = -1;
      let portalIdIndex = -1;

      for (let i = 0; i < columnNameRow.length; i++) {
        const columnName = columnNameRow[i]?.toLowerCase().trim();
        if (columnName.includes('portal') && columnName.includes('lookup')) {
          lookupKeyIndex = i;
        }
        if (columnName.includes('portal') && columnName.includes('id') && !columnName.includes('lookup')) {
          portalIdIndex = i;
        }
      }

      if (lookupKeyIndex === -1 || portalIdIndex === -1) {
        throw new Error('Portal columns not found in roster metadata');
      }

      console.log(`Found Portal columns: Lookup Key at ${lookupKeyIndex}, Portal ID at ${portalIdIndex}`);

      // Step 2: Get just the Portal columns for all rows
      // Convert column indices to Excel column letters (supports columns beyond Z)
      function getColumnLetter(columnIndex: number): string {
        let result = '';
        while (columnIndex >= 0) {
          result = String.fromCharCode(65 + (columnIndex % 26)) + result;
          columnIndex = Math.floor(columnIndex / 26) - 1;
        }
        return result;
      }

      const lookupColumnLetter = getColumnLetter(lookupKeyIndex);
      const portalColumnLetter = getColumnLetter(portalIdIndex);

      console.log(`Using columns: ${lookupColumnLetter} (index ${lookupKeyIndex}) and ${portalColumnLetter} (index ${portalIdIndex})`);

      // Use actual sheet dimensions to avoid exceeding limits
      const maxRow = Math.max(SHEET_CONFIG.DATA_START_ROW, rosterSheet.rowCount - 1); // Ensure we have at least data start row, but don't exceed actual rows
      const lookupData = await getSheetData(ROSTER_SHEET_ID, `${lookupColumnLetter}${SHEET_CONFIG.DATA_START_ROW}:${lookupColumnLetter}${maxRow}`);
      const portalData = await getSheetData(ROSTER_SHEET_ID, `${portalColumnLetter}${SHEET_CONFIG.DATA_START_ROW}:${portalColumnLetter}${maxRow}`);

      // Step 3: Build cache entries
      const entries: PortalEntry[] = [];
      const maxRows = Math.max(lookupData.length, portalData.length);

      for (let i = 0; i < maxRows; i++) {
        const lookupKey = lookupData[i]?.[0]?.toString().trim();
        const portalId = portalData[i]?.[0]?.toString().trim();

        // Only include rows that have both values and look like valid data
        // Skip header rows and test data
        if (lookupKey && portalId &&
            !lookupKey.includes('Portal') && // Skip header row
            lookupKey.length > 3 && // Must be meaningful length
            portalId.length > 3) { // Must be meaningful length
          entries.push({
            lookupKey,
            portalId,
            rowIndex: i + SHEET_CONFIG.DATA_START_ROW // Actual sheet row (accounting for metadata)
          });
        }
      }

      // Update cache
      portalCache = {
        data: entries,
        lastUpdated: Date.now(),
        isRefreshing: false
      };

      console.log(`Portal cache refreshed: ${entries.length} entries loaded`);

    } catch (error) {
      console.error('Error refreshing portal cache:', error);
      portalCache.isRefreshing = false;
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Find portal ID by lookup key
 */
export async function findPortalIdByLookupKey(lookupKey: string): Promise<string | null> {
  const entries = await getPortalCache();
  const entry = entries.find(e => e.lookupKey === lookupKey);
  return entry?.portalId || null;
}

/**
 * Find portal entry by portal ID
 */
export async function findPortalEntryByPortalId(portalId: string): Promise<PortalEntry | null> {
  const entries = await getPortalCache();
  return entries.find(e => e.portalId === portalId) || null;
}

/**
 * Get cache stats for debugging
 */
export function getPortalCacheStats() {
  const age = Date.now() - portalCache.lastUpdated;
  const isStale = age > CACHE_DURATION;

  return {
    entryCount: portalCache.data.length,
    lastUpdated: new Date(portalCache.lastUpdated).toISOString(),
    ageMs: age,
    isStale,
    isRefreshing: portalCache.isRefreshing
  };
}

/**
 * Force refresh the cache (for debugging/admin use)
 */
export async function forceRefreshPortalCache(): Promise<void> {
  portalCache.lastUpdated = 0; // Force stale
  await refreshPortalCache();
}