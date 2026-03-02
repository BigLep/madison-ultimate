import { getCachedSheetData, findCachedSheetRow } from './sheet-cache';
import { SHEET_CONFIG, ROSTER_FIRST_DATA_ROW } from './sheet-config';
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
  const sheetId = SHEET_CONFIG.ROSTER_SHEET_ID;
  const sheetIdSuffix = sheetId.length >= 8 ? sheetId.slice(-8) : sheetId;
  console.log('[portal-cache] Refreshing portal cache from sheet data...', { sheetIdSuffix: `...${sheetIdSuffix}` });

  try {
    // Get the full roster sheet (this uses the sheet cache)
    const rosterData = await getCachedSheetData('ROSTER');

    if (rosterData.length < 2) {
      throw new Error('Invalid roster data structure: need at least header row and one data row');
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

    // Build portal entries from the data rows. Header row is index 0; first data row from ROSTER_FIRST_DATA_ROW (0-based = row - 1).
    const dataStartIndex = ROSTER_FIRST_DATA_ROW - 1;
    const entries: PortalEntry[] = [];
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

    const sampleKeys = entries.slice(0, 5).map(e => e.lookupKey);
    console.log('[portal-cache] Refreshed', { entryCount: entries.length, sampleLookupKeys: sampleKeys });

  } catch (error) {
    console.error('Error refreshing portal cache:', error);
    throw error;
  }
}

/**
 * Normalize lookup key for comparison: lowercase, trim (so roster "APett1011" or " apett1011 " matches login "apett1011").
 */
function normalizeLookupKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Find portal ID by lookup key (case-insensitive, trim-safe).
 */
export async function findPortalIdByLookupKey(lookupKey: string): Promise<string | null> {
  const entries = await getPortalCache();
  const normalized = normalizeLookupKey(lookupKey);
  const entry = entries.find(e => normalizeLookupKey(e.lookupKey) === normalized);
  if (entry) {
    console.log('[portal-cache] findPortalIdByLookupKey', { lookupKey, found: true, entryCount: entries.length });
    return entry.portalId;
  }
  console.log('[portal-cache] findPortalIdByLookupKey', { lookupKey, normalized, found: false, entryCount: entries.length });
  return null;
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