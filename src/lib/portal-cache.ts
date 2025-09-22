import { getCachedSheetData, findCachedSheetRow } from './sheet-cache';

interface PortalEntry {
  lookupKey: string;
  portalId: string;
  rowIndex: number; // Row index in the sheet (0-based)
  rowData: any[]; // Full row data for this player
}

interface PortalCache {
  entries: PortalEntry[];
  columnMapping: Record<string, number>;
  lastUpdated: number;
}

// In-memory processed portal cache
let portalCache: PortalCache | null = null;

/**
 * Get portal cache with optimized sheet-based caching
 */
export async function getPortalCache(): Promise<PortalEntry[]> {
  // Check if we need to refresh the processed cache
  const now = Date.now();
  const cacheAge = portalCache ? now - portalCache.lastUpdated : Infinity;
  const PROCESSED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  if (!portalCache || cacheAge > PROCESSED_CACHE_TTL) {
    await refreshPortalCache();
  }

  return portalCache!.entries;
}

/**
 * Refresh portal cache from sheet cache
 */
async function refreshPortalCache(): Promise<void> {
  console.log('Refreshing portal cache from sheet data...');

  try {
    // Get the full roster sheet (this uses the sheet cache)
    const rosterData = await getCachedSheetData('ROSTER');

    if (rosterData.length < 4) {
      throw new Error('Invalid roster data structure');
    }

    // Extract column mapping from the first row
    const columnNameRow = rosterData[0];
    const columnMapping: Record<string, number> = {};

    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.toString().trim();
      if (columnName) {
        columnMapping[columnName] = i;
      }
    }

    // Find portal columns
    let lookupKeyIndex = -1;
    let portalIdIndex = -1;

    for (const [columnName, index] of Object.entries(columnMapping)) {
      const lowerName = columnName.toLowerCase();
      if (lowerName.includes('portal') && lowerName.includes('lookup')) {
        lookupKeyIndex = index;
      }
      if (lowerName.includes('portal') && lowerName.includes('id') && !lowerName.includes('lookup')) {
        portalIdIndex = index;
      }
    }

    if (lookupKeyIndex === -1 || portalIdIndex === -1) {
      throw new Error('Portal columns not found in roster data');
    }

    console.log(`Found Portal columns: Lookup Key at ${lookupKeyIndex}, Portal ID at ${portalIdIndex}`);

    // Build portal entries from the data rows (skip header rows)
    const entries: PortalEntry[] = [];
    const dataStartIndex = 4; // Skip metadata rows

    for (let i = dataStartIndex; i < rosterData.length; i++) {
      const row = rosterData[i];
      const lookupKey = row[lookupKeyIndex]?.toString().trim();
      const portalId = row[portalIdIndex]?.toString().trim();

      // Only include rows with valid portal data
      if (lookupKey && portalId &&
          !lookupKey.includes('Portal') && // Skip any header rows
          lookupKey.length > 3 &&
          portalId.length > 3) {
        entries.push({
          lookupKey,
          portalId,
          rowIndex: i,
          rowData: row
        });
      }
    }

    // Update cache
    portalCache = {
      entries,
      columnMapping,
      lastUpdated: Date.now()
    };

    console.log(`Portal cache refreshed: ${entries.length} entries loaded`);

  } catch (error) {
    console.error('Error refreshing portal cache:', error);
    throw error;
  }
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
 * Get player data by portal ID from cached roster
 */
export async function getPlayerDataByPortalId(portalId: string): Promise<any | null> {
  const entry = await findPortalEntryByPortalId(portalId);
  if (!entry) {
    return null;
  }

  // Return the full row data along with column mapping for easy access
  return {
    rowData: entry.rowData,
    rowIndex: entry.rowIndex,
    columnMapping: portalCache!.columnMapping
  };
}

/**
 * Get column value from player data
 */
export function getColumnValue(playerData: any, columnName: string): string | null {
  const columnIndex = playerData.columnMapping[columnName];
  if (columnIndex === undefined) {
    return null;
  }
  return playerData.rowData[columnIndex]?.toString().trim() || null;
}

/**
 * Get cache stats for debugging
 */
export function getPortalCacheStats() {
  if (!portalCache) {
    return {
      entryCount: 0,
      lastUpdated: null,
      ageMs: 0,
      isStale: true
    };
  }

  const age = Date.now() - portalCache.lastUpdated;
  const isStale = age > 5 * 60 * 1000; // 5 minutes

  return {
    entryCount: portalCache.entries.length,
    lastUpdated: new Date(portalCache.lastUpdated).toISOString(),
    ageMs: age,
    isStale,
    columnCount: Object.keys(portalCache.columnMapping).length
  };
}

/**
 * Force refresh the portal cache
 */
export async function forceRefreshPortalCache(): Promise<void> {
  portalCache = null; // Force refresh
  await refreshPortalCache();
}