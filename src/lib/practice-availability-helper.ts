import { getBatchSheetData } from './google-api';
import { getCachedSheetData, forceRefreshSheetCache } from './sheet-cache';
import { SHEET_CONFIG } from './sheet-config';
import { PRACTICE_CONFIG } from './practice-config';

/**
 * Get fresh practice availability data for a specific player using cached player mappings
 */
export async function getPlayerPracticeAvailability(playerFullName: string): Promise<{
  headerRow: any[];
  playerRow: any[];
  rowIndex: number;
} | null> {
  try {
    // Get cached player name list (column A only)
    const playerData = await getCachedSheetData('PRACTICE_AVAILABILITY_PLAYERS');

    if (!playerData || playerData.length < 2) {
      throw new Error('No practice availability player data found');
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
      console.log(`Player "${playerFullName}" not found in cached player list, refreshing cache...`);

      // Refresh the player cache and try again
      await forceRefreshSheetCache('PRACTICE_AVAILABILITY_PLAYERS');
      const refreshedPlayerData = await getCachedSheetData('PRACTICE_AVAILABILITY_PLAYERS');

      // Try to find the player again
      for (let i = 1; i < refreshedPlayerData.length; i++) {
        const playerName = refreshedPlayerData[i][0]?.toString().trim();
        if (playerName === playerFullName) {
          playerRowIndex = i + 1; // Convert to 1-based row index
          break;
        }
      }

      if (playerRowIndex === -1) {
        console.log(`Player "${playerFullName}" not found after cache refresh`);
        return null;
      }
    }

    // Fetch header row (row 1) and player row in a single batch request
    const ranges = [
      `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!1:1`, // Header row
      `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${playerRowIndex}:${playerRowIndex}` // Player row
    ];

    const batchResponse = await getBatchSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, ranges);

    if (!batchResponse || batchResponse.length < 2) {
      throw new Error('Failed to fetch header and player rows');
    }

    const headerRow = batchResponse[0]?.[0] || [];
    const playerRow = batchResponse[1]?.[0] || [];

    // Verify we got the right player
    const fetchedPlayerName = playerRow[PRACTICE_CONFIG.AVAILABILITY_COLUMNS.FULL_NAME]?.toString().trim();

    if (fetchedPlayerName !== playerFullName) {
      console.log(`Row mismatch: expected "${playerFullName}", got "${fetchedPlayerName}". Refreshing cache...`);

      // Refresh cache and try once more
      await forceRefreshSheetCache('PRACTICE_AVAILABILITY_PLAYERS');
      return await getPlayerPracticeAvailability(playerFullName);
    }

    return {
      headerRow,
      playerRow,
      rowIndex: playerRowIndex
    };

  } catch (error) {
    console.error('Error fetching player practice availability:', error);
    throw error;
  }
}