import { getSheetData } from './google-api';

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

      // Step 1: Get metadata to find Portal columns
      const metadataRows = await getSheetData(ROSTER_SHEET_ID, 'A1:AZ4');

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
      // Use exact column ranges for AQ and AR (the Portal columns)
      const lookupData = await getSheetData(ROSTER_SHEET_ID, 'AQ5:AQ1000');
      const portalData = await getSheetData(ROSTER_SHEET_ID, 'AR5:AR1000');

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
            rowIndex: i + 5 // Actual sheet row (accounting for metadata)
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