import { getBatchSheetData } from './google-api';
import { getCachedSheetData, forceRefreshSheetCache } from './sheet-cache';
import { SHEET_CONFIG } from './sheet-config';

/**
 * Shared availability helper for both practice and game availability
 */

export interface AvailabilityResult {
  headerRow: any[];
  playerRow: any[];
  rowIndex: number;
  columnMapping: Record<string, number>;
}

export interface ColumnIndices {
  availabilityColumn: number;
  noteColumn: number;
}

/**
 * Get player availability data from a specific sheet
 */
export async function getPlayerAvailabilityData(
  playerFullName: string,
  playerCacheKey: 'PRACTICE_AVAILABILITY_PLAYERS' | 'GAME_AVAILABILITY_PLAYERS',
  sheetName: string,
  playerNameColumnIndex: number = 0
): Promise<AvailabilityResult | null> {
  try {
    // Get cached player name list (column A only)
    const playerData = await getCachedSheetData(playerCacheKey);

    if (!playerData || playerData.length < 2) {
      throw new Error(`No ${playerCacheKey.toLowerCase()} data found`);
    }

    // Find the player's row index (skip header row)
    let playerRowIndex = -1;
    for (let i = 1; i < playerData.length; i++) {
      const playerName = playerData[i][0]?.toString().trim();
      if (playerName === playerFullName) {
        playerRowIndex = i + 1; // Convert to 1-based row index
        break;
      }
    }

    if (playerRowIndex === -1) {
      console.log(`Player "${playerFullName}" not found in cached ${playerCacheKey}, refreshing cache...`);

      // Refresh the player cache and try again
      await forceRefreshSheetCache(playerCacheKey);
      const refreshedPlayerData = await getCachedSheetData(playerCacheKey);

      // Try to find the player again
      if (refreshedPlayerData) {
        for (let i = 1; i < refreshedPlayerData.length; i++) {
          const playerName = refreshedPlayerData[i][0]?.toString().trim();
          if (playerName === playerFullName) {
            playerRowIndex = i + 1; // Convert to 1-based row index
            break;
          }
        }
      }

      if (playerRowIndex === -1) {
        console.log(`Player "${playerFullName}" not found after cache refresh`);
        return null;
      }
    }

    // Fetch header row (row 1) and player row in a single batch request
    const ranges = [
      `'${sheetName}'!1:1`, // Header row
      `'${sheetName}'!${playerRowIndex}:${playerRowIndex}` // Player row
    ];

    const batchResponse = await getBatchSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, ranges);

    if (!batchResponse || batchResponse.length < 2) {
      throw new Error('Failed to fetch header and player rows');
    }

    const headerRow = batchResponse[0]?.[0] || [];
    const playerRow = batchResponse[1]?.[0] || [];

    // Verify we got the right player
    const fetchedPlayerName = playerRow[playerNameColumnIndex]?.toString().trim();

    if (fetchedPlayerName !== playerFullName) {
      console.log(`Row mismatch: expected "${playerFullName}", got "${fetchedPlayerName}". Refreshing cache...`);

      // Refresh cache and try once more
      await forceRefreshSheetCache(playerCacheKey);
      return await getPlayerAvailabilityData(playerFullName, playerCacheKey, sheetName, playerNameColumnIndex);
    }

    // Create column mapping from header row
    const columnMapping: Record<string, number> = {};
    headerRow.forEach((header, index) => {
      if (header) {
        columnMapping[header.toString().trim()] = index;
      }
    });

    return {
      headerRow,
      playerRow,
      rowIndex: playerRowIndex,
      columnMapping
    };

  } catch (error) {
    console.error('Error fetching player availability:', error);
    throw error;
  }
}

/**
 * Find columns for a specific date in the header row
 * Works for both practices and games - looks for date pattern and corresponding note column
 */
export function findDateColumns(headerRow: any[], date: string): ColumnIndices | null {
  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i]?.toString().trim();

    // Look for exact date match
    if (header === date) {
      // Availability column is the date column
      const availabilityColumn = i;

      // Note column should be the next column with " Note" suffix
      const noteColumn = i + 1;
      const nextHeader = headerRow[noteColumn]?.toString().trim();

      if (nextHeader === `${date} Note`) {
        return { availabilityColumn, noteColumn };
      }
    }
  }

  return null;
}

/**
 * Convert column index to letter format (A, B, C, ...)
 */
export function getColumnLetter(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}