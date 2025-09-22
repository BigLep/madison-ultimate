import { getSheetData } from './google-api';
import { SHEET_CONFIG } from './sheet-config';

// Cache configuration for each sheet type
interface SheetCacheConfig {
  sheetId: string;
  sheetName: string;
  cacheTTL: number; // Time-to-live in milliseconds
  range?: string; // Optional: specific range to cache, defaults to entire sheet
}

// Define cache configuration for each sheet
export const SHEET_CACHE_CONFIG: Record<string, SheetCacheConfig> = {
  ROSTER: {
    sheetId: SHEET_CONFIG.ROSTER_SHEET_ID,
    sheetName: SHEET_CONFIG.ROSTER_SHEET_NAME,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  },
  PRACTICE_INFO: {
    sheetId: SHEET_CONFIG.ROSTER_SHEET_ID, // Same workbook, different sheet
    sheetName: SHEET_CONFIG.PRACTICE_INFO_SHEET_NAME,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  },
  GAME_INFO: {
    sheetId: SHEET_CONFIG.ROSTER_SHEET_ID, // Same workbook, different sheet
    sheetName: SHEET_CONFIG.GAME_INFO_SHEET_NAME,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  },
  PRACTICE_AVAILABILITY: {
    sheetId: SHEET_CONFIG.ROSTER_SHEET_ID,
    sheetName: SHEET_CONFIG.PRACTICE_AVAILABILITY_SHEET_NAME,
    cacheTTL: 1 * 60 * 1000, // 1 minute - more dynamic data
  },
  GAME_AVAILABILITY: {
    sheetId: SHEET_CONFIG.ROSTER_SHEET_ID,
    sheetName: SHEET_CONFIG.GAME_AVAILABILITY_SHEET_NAME,
    cacheTTL: 1 * 60 * 1000, // 1 minute - more dynamic data
  }
};

interface SheetCacheEntry {
  data: any[][];
  lastUpdated: number;
  isRefreshing: boolean;
}

// In-memory cache for all sheets
const sheetCache: Map<string, SheetCacheEntry> = new Map();

// Active refresh promises to prevent duplicate fetches
const refreshPromises: Map<string, Promise<void>> = new Map();

/**
 * Get cached sheet data, refreshing if needed
 */
export async function getCachedSheetData(sheetType: string, range?: string): Promise<any[][]> {
  const config = SHEET_CACHE_CONFIG[sheetType];
  if (!config) {
    throw new Error(`Unknown sheet type: ${sheetType}`);
  }

  const cacheKey = `${sheetType}:${range || 'full'}`;
  const now = Date.now();
  const cached = sheetCache.get(cacheKey);

  const isStale = !cached || (now - cached.lastUpdated > config.cacheTTL);

  if (isStale) {
    // If cache is stale, refresh
    await refreshSheetCache(sheetType, range);
  }

  const finalCached = sheetCache.get(cacheKey);
  if (!finalCached) {
    throw new Error(`Failed to cache sheet data for ${sheetType}`);
  }

  return finalCached.data;
}

/**
 * Refresh specific sheet cache
 */
async function refreshSheetCache(sheetType: string, range?: string): Promise<void> {
  const config = SHEET_CACHE_CONFIG[sheetType];
  const cacheKey = `${sheetType}:${range || 'full'}`;

  // If already refreshing, wait for that operation
  const existingPromise = refreshPromises.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  // Mark as refreshing
  const cached = sheetCache.get(cacheKey);
  if (cached) {
    cached.isRefreshing = true;
  }

  const refreshPromise = (async () => {
    try {
      console.log(`Refreshing sheet cache: ${sheetType} (${range || 'full sheet'})`);

      // Determine the range to fetch
      const fetchRange = range || config.range;
      let sheetRange: string;

      if (fetchRange) {
        // Use specific range
        sheetRange = `${config.sheetName}!${fetchRange}`;
      } else {
        // Fetch entire sheet
        sheetRange = config.sheetName;
      }

      const data = await getSheetData(config.sheetId, sheetRange);

      // Update cache
      sheetCache.set(cacheKey, {
        data,
        lastUpdated: Date.now(),
        isRefreshing: false
      });

      console.log(`Sheet cache refreshed: ${sheetType} - ${data.length} rows cached`);

    } catch (error) {
      console.error(`Error refreshing sheet cache for ${sheetType}:`, error);

      // Mark as not refreshing on error
      const cached = sheetCache.get(cacheKey);
      if (cached) {
        cached.isRefreshing = false;
      }

      throw error;
    } finally {
      refreshPromises.delete(cacheKey);
    }
  })();

  refreshPromises.set(cacheKey, refreshPromise);
  return refreshPromise;
}

/**
 * Get specific row from cached sheet data
 */
export async function getCachedSheetRow(sheetType: string, rowIndex: number): Promise<any[] | null> {
  const data = await getCachedSheetData(sheetType);
  return data[rowIndex] || null;
}

/**
 * Find row in cached sheet data by column value
 */
export async function findCachedSheetRow(
  sheetType: string,
  columnIndex: number,
  value: string
): Promise<{ row: any[], index: number } | null> {
  const data = await getCachedSheetData(sheetType);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row[columnIndex]?.toString().trim() === value.trim()) {
      return { row, index: i };
    }
  }

  return null;
}

/**
 * Get cache statistics for monitoring
 */
export function getSheetCacheStats(): Record<string, any> {
  const stats: Record<string, any> = {};

  for (const [cacheKey, cached] of sheetCache.entries()) {
    const age = Date.now() - cached.lastUpdated;
    const [sheetType] = cacheKey.split(':');
    const config = SHEET_CACHE_CONFIG[sheetType];
    const isStale = config ? age > config.cacheTTL : false;

    stats[cacheKey] = {
      rowCount: cached.data.length,
      lastUpdated: new Date(cached.lastUpdated).toISOString(),
      ageMs: age,
      isStale,
      isRefreshing: cached.isRefreshing,
      ttl: config?.cacheTTL || 0
    };
  }

  return stats;
}

/**
 * Force clear all sheet caches
 */
export function clearAllSheetCaches(): void {
  console.log('Clearing all sheet caches...');
  sheetCache.clear();
  refreshPromises.clear();
}

/**
 * Force clear specific sheet cache
 */
export function clearSheetCache(sheetType: string, range?: string): void {
  const cacheKey = `${sheetType}:${range || 'full'}`;
  console.log(`Clearing sheet cache: ${cacheKey}`);
  sheetCache.delete(cacheKey);
  refreshPromises.delete(cacheKey);
}

/**
 * Force refresh specific sheet cache
 */
export async function forceRefreshSheetCache(sheetType: string, range?: string): Promise<void> {
  clearSheetCache(sheetType, range);
  await refreshSheetCache(sheetType, range);
}

/**
 * Preload commonly used sheet caches
 */
export async function preloadSheetCaches(): Promise<void> {
  console.log('Preloading sheet caches...');

  try {
    // Preload critical sheets in parallel
    await Promise.allSettled([
      getCachedSheetData('ROSTER'),
      getCachedSheetData('PRACTICE_INFO'),
      getCachedSheetData('GAME_INFO')
    ]);

    console.log('Sheet caches preloaded successfully');
  } catch (error) {
    console.error('Error preloading sheet caches:', error);
  }
}