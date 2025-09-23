import { getCachedSheetData, findCachedSheetRow } from './sheet-cache';
import { validateColumns, createValidationErrorMessage, PORTAL_COLUMN_PATTERNS } from './column-validation';

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
    const availableColumns: string[] = [];

    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.toString().trim();
      if (columnName) {
        columnMapping[columnName] = i;
        availableColumns.push(columnName);
      }
    }

    // Validate that all required columns exist
    console.log('Validating roster column structure...');
    const validationResult = validateColumns(availableColumns);

    if (!validationResult.isValid) {
      const errorMessage = createValidationErrorMessage(validationResult);
      console.error('❌ Column validation failed:', errorMessage);
      throw new Error(`Roster column validation failed:\n${errorMessage}`);
    }

    if (validationResult.missingOptional.length > 0) {
      console.warn('⚠️ Missing optional columns:', validationResult.missingOptional.join(', '));
    }

    console.log('✅ Column validation passed');
    if (validationResult.extraColumns.length > 0) {
      console.log('📊 Extra columns found:', validationResult.extraColumns.slice(0, 5).join(', '), validationResult.extraColumns.length > 5 ? '...' : '');
    }

    // Use validated portal columns from validation result
    const lookupKeyColumn = validationResult.portalColumns.lookupKey!;
    const portalIdColumn = validationResult.portalColumns.portalId!;
    const lookupKeyIndex = columnMapping[lookupKeyColumn];
    const portalIdIndex = columnMapping[portalIdColumn];

    console.log(`Found Portal columns: "${lookupKeyColumn}" at ${lookupKeyIndex}, "${portalIdColumn}" at ${portalIdIndex}`);

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